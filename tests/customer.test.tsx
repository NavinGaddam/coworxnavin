// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import CustomerPicker from "../src/components/CustomerPicker";
import { customerMatches, validateCustomer } from "../src/lib/customer";
import { createCustomerProfile } from "../src/lib/firestore";
vi.mock("../src/lib/firestore", () => ({ createCustomerProfile: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const draft = {
  name: "GOPP",
  email: "gopp@gmail.com",
  phone: "4575757575",
  dob: "2000-05-22",
  profession: "Marketing Team",
  gender: "Female",
};
function fill() {
  for (const [label, key] of [
    ["Full name", "name"],
    ["Email", "email"],
    ["Mobile", "phone"],
    ["Date of birth", "dob"],
    ["Profession", "profession"],
    ["Gender", "gender"],
  ])
    fireEvent.change(screen.getByLabelText(new RegExp(label)), {
      target: { value: draft[key] },
    });
}
describe("walk-in customer regression", () => {
  it("saves the email entered in the new form and selects the returned database identity", async () => {
    let finish: any;
    vi.mocked(createCustomerProfile).mockImplementation(
      () => new Promise((resolve) => (finish = resolve)),
    );
    const select = vi.fn();
    render(
      <CustomerPicker
        user={{ uid: "admin", email: "owner@example.com" }}
        onSelect={select}
      />,
    );
    fireEvent.change(screen.getByLabelText("Search customers"), {
      target: { value: "a previous search" },
    });
    fireEvent.click(screen.getByText("Add new customer"));
    fill();
    select.mockClear();
    fireEvent.click(screen.getByText("Save customer & continue"));
    expect(createCustomerProfile).toHaveBeenCalledWith(
      draft,
      "admin",
      "owner@example.com",
    );
    expect(select).not.toHaveBeenCalled();
    finish({ ...draft, uid: "saved-customer", id: "saved-customer" });
    await waitFor(() =>
      expect(select).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: "saved-customer",
          email: "gopp@gmail.com",
        }),
      ),
    );
  });
  it("keeps the draft and does not continue when saving fails", async () => {
    vi.mocked(createCustomerProfile).mockRejectedValue(
      new Error("Missing or insufficient permissions."),
    );
    const select = vi.fn();
    render(<CustomerPicker user={{ uid: "staff" }} onSelect={select} />);
    fireEvent.click(screen.getByText("Add new customer"));
    fill();
    select.mockClear();
    fireEvent.click(screen.getByText("Save customer & continue"));
    await screen.findByRole("alert");
    expect(select).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Email/) as HTMLInputElement).value).toBe(
      draft.email,
    );
  });
  it("selects an existing searched customer without creating another profile", () => {
    const select = vi.fn();
    render(
      <CustomerPicker
        user={{ uid: "staff" }}
        users={[{ ...draft, uid: "existing" }]}
        onSelect={select}
      />,
    );
    fireEvent.focus(screen.getByLabelText("Search customers"));
    fireEvent.change(screen.getByLabelText("Search customers"), {
      target: { value: "gopp" },
    });
    fireEvent.click(screen.getByText("GOPP"));
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "existing" }),
    );
    expect(createCustomerProfile).not.toHaveBeenCalled();
  });
  it("does not treat a text search as an empty phone-number match", () => {
    expect(customerMatches(draft, "Rahul")).toBe(false);
    expect(customerMatches(draft, "4575")).toBe(true);
  });
  it("normalizes copied email addresses and rejects impossible birth dates", () => {
    expect(
      validateCustomer({ ...draft, email: " GOPP@GMAIL.COM " }, "2026-09-09")
        .email,
    ).toBe("gopp@gmail.com");
    expect(() =>
      validateCustomer({ ...draft, dob: "2000-02-31" }, "2026-09-09"),
    ).toThrow("date of birth");
  });
});
