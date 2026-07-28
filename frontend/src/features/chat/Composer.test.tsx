import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from './Composer';

describe('Composer', () => {
  it('sends on Enter and clears the field', () => {
    const onSend = vi.fn(() => true);
    render(<Composer onSend={onSend} />);

    const textarea = screen.getByLabelText('Message');
    fireEvent.change(textarea, { target: { value: 'hello world' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('hello world');
    expect(textarea).toHaveValue('');
  });

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn(() => true);
    render(<Composer onSend={onSend} />);

    const textarea = screen.getByLabelText('Message');
    fireEvent.change(textarea, { target: { value: 'line one' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('line one');
  });

  it('ignores empty input and keeps the draft when the send fails', () => {
    const onSend = vi.fn(() => false);
    render(<Composer onSend={onSend} />);

    const textarea = screen.getByLabelText('Message');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: 'still here' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('still here');
    expect(textarea).toHaveValue('still here');
  });

  it('disables the send button for whitespace-only input', () => {
    const onSend = vi.fn(() => true);
    render(<Composer onSend={onSend} />);

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });
});
