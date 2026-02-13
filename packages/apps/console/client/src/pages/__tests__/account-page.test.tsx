import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route } from "wouter";

import AccountPage from "../account-page";
import { getQueryFn } from "@/lib/queryClient";

describe("AccountPage", () => {
  it("renders at /account and shows account heading", () => {
    window.history.pushState({}, "", "/account");

    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: getQueryFn({ on401: "throw" }),
        },
      },
    });
    render(
      <QueryClientProvider client={qc}>
        <Route path="/account" component={AccountPage} />
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /account/i })).toBeInTheDocument();
  });
});

