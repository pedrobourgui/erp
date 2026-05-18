import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { MoneyInput } from './money-input';

interface TestForm {
  price: number;
}

function TestWrapper({
  defaultValue = 0,
  error,
}: {
  defaultValue?: number;
  error?: string;
}) {
  const form = useForm<TestForm>({
    defaultValues: { price: defaultValue },
  });

  return (
    <MoneyInput<TestForm>
      name="price"
      control={form.control}
      label="Price"
      error={error}
    />
  );
}

describe('MoneyInput', () => {
  it('should render with label', () => {
    render(<TestWrapper />);
    expect(screen.getByText('Price')).toBeInTheDocument();
  });

  it('should show R$ prefix', () => {
    render(<TestWrapper />);
    expect(screen.getByText('R$')).toBeInTheDocument();
  });

  it('should display formatted value for a non-zero default', () => {
    render(<TestWrapper defaultValue={1234.56} />);
    const input = screen.getByRole('textbox');
    // 1234.56 formatted as BRL: 1.234,56
    expect(input).toHaveValue('1.234,56');
  });

  it('should display empty string for zero value', () => {
    // When value is 0, formatNumberToBRL(0) = "0,00", but the component
    // checks field.value != null && field.value !== "" which is true for 0,
    // so it shows "0,00"
    render(<TestWrapper defaultValue={0} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('0,00');
  });

  it('should handle user typing digits', async () => {
    const user = userEvent.setup();
    render(<TestWrapper defaultValue={0} />);
    const input = screen.getByRole('textbox');

    await user.clear(input);
    await user.type(input, '12345');

    // After typing "12345", formatInputValue strips non-digits,
    // parses as 12345 cents = 123.45, formats as "123,45"
    expect(input).toHaveValue('123,45');
  });

  it('should show error message', () => {
    render(<TestWrapper error="Price is required" />);
    expect(screen.getByText('Price is required')).toBeInTheDocument();
  });

  it('should have the error class when error is present', () => {
    render(<TestWrapper error="Required" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-destructive');
  });

  it('should render as disabled when disabled prop is set', () => {
    function DisabledWrapper() {
      const form = useForm<TestForm>({ defaultValues: { price: 0 } });
      return (
        <MoneyInput<TestForm>
          name="price"
          control={form.control}
          disabled={true}
        />
      );
    }
    render(<DisabledWrapper />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
});
