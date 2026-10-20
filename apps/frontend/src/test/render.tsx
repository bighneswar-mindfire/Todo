import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AppProviders } from "@/components/AppProviders";
import { routes } from "@/routes/router";
import { QueryClient } from "@tanstack/react-query";

export function renderApp(initialEntry: string | { pathname: string; state?: unknown } = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const user = userEvent.setup();
  render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, client, user };
}
