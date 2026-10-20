import { createBrowserRouter, type RouteObject } from "react-router";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { NotesPage } from "@/pages/NotesPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { RedirectIfAuthed, RequireAuth } from "./guards";
import { NotFound } from "./NotFound";

export const routes: RouteObject[] = [
  {
    Component: RedirectIfAuthed,
    children: [
      { path: "/login", Component: LoginPage },
      { path: "/register", Component: RegisterPage },
      { path: "/forgot-password", Component: ForgotPasswordPage },
      { path: "/reset-password", Component: ResetPasswordPage },
    ],
  },
  {
    Component: RequireAuth,
    children: [{ path: "/", Component: NotesPage }],
  },
  { path: "*", Component: NotFound },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
