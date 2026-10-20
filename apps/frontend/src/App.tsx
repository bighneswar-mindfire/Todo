import { RouterProvider } from "react-router/dom";
import { AppProviders } from "@/components/AppProviders";
import { createAppRouter } from "@/routes/router";

// Created once, outside the React tree.
const router = createAppRouter();

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
