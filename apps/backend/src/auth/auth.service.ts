import type { AuthTokensResponse, LoginRequest, RegisterRequest, User } from "@todo/shared";
import { AppError } from "../errors.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
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
}

export interface AuthService {
  register(input: RegisterRequest): Promise<User>;
  login(input: LoginRequest): Promise<AuthTokensResponse>;
}

const userSelect = { id: true, email: true, createdAt: true } as const;

function toUser(row: { id: string; email: string; createdAt: Date }): User {
  return { id: row.id, email: row.email, createdAt: row.createdAt.toISOString() };
}

function invalidCredentials(): AppError {
  return new AppError("INVALID_CREDENTIALS", 401, "Invalid email or password");
}

export function createAuthService({ prisma, hasher, jwt }: AuthServiceDeps): AuthService {
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
  };
}
