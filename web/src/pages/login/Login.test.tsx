import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import Login from './Login';

describe('Login', () => {
  it('renders login form', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeDefined();
    expect(screen.getByRole('textbox')).toBeDefined();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
  });
});
