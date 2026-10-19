import type {
  AuthTokensResponse,
  ForgotPasswordResponse,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  TokenPair,
  User,
} from "@todo/shared";
import { AppError } from "../errors.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  consoleOtpSender,
  generateOtp,
  hashOtp,
  verifyOtp,
  type OtpSender,
} from "./otp.js";
import { createDummyHash, type PasswordHasher } from "./password.js";
import {
  REFRESH_TOKEN_TTL_MS,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from "./tokens.js";

export interface AuthServiceDeps {
  prisma: PrismaClient;
  hasher: PasswordHasher;
  jwt: { secret: string };
  otpSender?: OtpSender;
}

export const FORGOT_PASSWORD_MESSAGE = "If the account exists, a reset code has been sent.";

export interface AuthService {
  register(input: RegisterRequest): Promise<User>;
  login(input: LoginRequest): Promise<AuthTokensResponse>;
  refresh(refreshToken: string): Promise<TokenPair>;
  logout(userId: string, refreshToken: string): Promise<void>;
  forgotPassword(email: string): Promise<ForgotPasswordResponse>;
  resetPassword(input: ResetPasswordRequest): Promise<void>;
}

type RotationResult =
  | { kind: "rotated"; refreshToken: string; userId: string }
  | { kind: "reuse" }
  | { kind: "invalid" };

type ResetResult = { kind: "reset" } | { kind: "invalid" };

const userSelect = { id: true, email: true, createdAt: true } as const;

function toUser(row: { id: string; email: string; createdAt: Date }): User {
  return { id: row.id, email: row.email, createdAt: row.createdAt.toISOString() };
}

function invalidCredentials(): AppError {
  return new AppError("INVALID_CREDENTIALS", 401, "Invalid email or password");
}

function invalidRefreshToken(): AppError {
  return new AppError("INVALID_REFRESH_TOKEN", 401, "Invalid refresh token");
}

function invalidOtp(): AppError {
  return new AppError("INVALID_OTP", 400, "Invalid or expired code");
}

export function createAuthService({
  prisma,
  hasher,
  jwt,
  otpSender = consoleOtpSender,
}: AuthServiceDeps): AuthService {
  // Started when the app is built so the first unknown-email login pays no extra cost.
  const dummyHash = createDummyHash(hasher);
  dummyHash.catch(() => undefined);

  return {
    async register({ email, password }) {
      const passwordHash = await hasher.hash(password);
      try {
        const row = await prisma.user.create({
          data: { email, passwordHash },
          select: userSelect,
        });
        return toUser(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new AppError("EMAIL_TAKEN", 409, "Email already registered");
        }
        throw err;
      }
    },

    async login({ email, password }) {
      const found = await prisma.user.findUnique({
        where: { email },
        select: { ...userSelect, passwordHash: true },
      });
      const valid = await hasher.verify(password, found?.passwordHash ?? (await dummyHash));
      if (!found || !valid) throw invalidCredentials();

      const refreshToken = generateRefreshToken();
      await prisma.refreshToken.create({
        data: {
          userId: found.id,
          tokenHash: hashRefreshToken(refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });
      const accessToken = await signAccessToken(found.id, jwt.secret);
      return { accessToken, refreshToken, user: toUser(found) };
    },

    // Rotation with reuse detection (design D4). The per-user row lock serializes all
    // refresh handling for a user; the transaction returns a result (never throws) so a
    // family revoke commits.
    async refresh(refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      const existing = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      if (!existing) throw invalidRefreshToken();
      const { userId } = existing;

      const result = await prisma.$transaction(async (tx): Promise<RotationResult> => {
        await tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;

        const row = await tx.refreshToken.findUnique({ where: { tokenHash } });
        if (!row) return { kind: "invalid" };

        const now = new Date();
        const revokeFamily = async (): Promise<RotationResult> => {
          await tx.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: now },
          });
          return { kind: "reuse" };
        };

        if (row.revokedAt !== null) return revokeFamily();
        if (row.expiresAt.getTime() <= now.getTime()) return { kind: "invalid" };

        const claimed = await tx.refreshToken.updateMany({
          where: { id: row.id, revokedAt: null },
          data: { revokedAt: now },
        });
        if (claimed.count === 0) return revokeFamily();

        const newToken = generateRefreshToken();
        await tx.refreshToken.create({
          data: {
            userId,
            tokenHash: hashRefreshToken(newToken),
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
          },
        });
        return { kind: "rotated", refreshToken: newToken, userId };
      });

      if (result.kind !== "rotated") throw invalidRefreshToken();
      const accessToken = await signAccessToken(result.userId, jwt.secret);
      return { accessToken, refreshToken: result.refreshToken };
    },

    // One scoped update: unknown, already-revoked and other users' tokens are all no-ops.
    async logout(userId, refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashRefreshToken(refreshToken), userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    // Unknown emails answer identically and leave no trace. The user-row lock serializes
    // concurrent requests so exactly one OTP stays active (design D3).
    async forgotPassword(email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) return { message: FORGOT_PASSWORD_MESSAGE };

      const otp = generateOtp();
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
        const now = new Date();
        await tx.passwordResetOtp.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: now },
        });
        await tx.passwordResetOtp.create({
          data: {
            userId: user.id,
            otpHash: hashOtp(otp, user.id, jwt.secret),
            expiresAt: new Date(now.getTime() + OTP_TTL_MS),
          },
        });
      });
      otpSender.send(email, otp);
      return { message: FORGOT_PASSWORD_MESSAGE };
    },

    // Reset (design D4). The new password is hashed first so unknown emails cost the same.
    // The transaction returns a result (never throws on a bad code) so a wrong attempt's
    // counter commits; the user-row lock serializes attempts and concurrent resets.
    async resetPassword({ email, otp, newPassword }) {
      const passwordHash = await hasher.hash(newPassword);
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) throw invalidOtp();
      const userId = user.id;

      const result = await prisma.$transaction(async (tx): Promise<ResetResult> => {
        await tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;

        const row = await tx.passwordResetOtp.findFirst({
          where: { userId, usedAt: null },
          orderBy: { createdAt: "desc" },
        });
        const now = new Date();
        if (!row || row.expiresAt.getTime() <= now.getTime() || row.attempts >= OTP_MAX_ATTEMPTS) {
          return { kind: "invalid" };
        }
        if (!verifyOtp(otp, userId, jwt.secret, row.otpHash)) {
          await tx.passwordResetOtp.update({
            where: { id: row.id },
            data: { attempts: { increment: 1 } },
          });
          return { kind: "invalid" };
        }

        const claimed = await tx.passwordResetOtp.updateMany({
          where: { id: row.id, usedAt: null },
          data: { usedAt: now },
        });
        if (claimed.count === 0) return { kind: "invalid" };

        await tx.user.update({ where: { id: userId }, data: { passwordHash } });
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { kind: "reset" };
      });

      if (result.kind !== "reset") throw invalidOtp();
    },
  };
}
