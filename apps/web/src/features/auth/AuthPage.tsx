import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, MessageCircleMore } from 'lucide-react';
import type { AuthResponse } from '@nestchat/contracts';
import { apiFetch, ApiRequestError } from '../../lib/api';
import { useAuthStore } from '../../state/auth-store';

interface AuthForm {
  username: string;
  password: string;
}

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const setAuth = useAuthStore((state) => state.setAuth);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthForm>();

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      const auth = await apiFetch<AuthResponse>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setAuth(auth);
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : 'Не удалось подключиться к серверу');
    }
  });

  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand-mark" aria-hidden="true">
          <MessageCircleMore size={28} strokeWidth={2.2} />
        </div>
        <h1 id="auth-title">NestChat</h1>
        <p className="auth-subtitle">Простое общение с важными людьми</p>

        <div className="auth-tabs" role="tablist" aria-label="Способ авторизации">
          <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => setMode('login')}>
            Войти
          </button>
          <button className={mode === 'register' ? 'active' : ''} type="button" onClick={() => setMode('register')}>
            Создать аккаунт
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          <label>
            <span>Имя пользователя</span>
            <input
              autoComplete="username"
              placeholder="ivanpetrov"
              {...register('username', {
                required: 'Введите имя пользователя',
                minLength: { value: 3, message: 'Минимум 3 символа' },
              })}
            />
            {errors.username ? <small className="field-error">{errors.username.message}</small> : null}
          </label>
          <label>
            <span>Пароль</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                {...register('password', {
                  required: 'Введите пароль',
                  minLength: { value: 8, message: 'Минимум 8 символов' },
                })}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password ? <small className="field-error">{errors.password.message}</small> : null}
          </label>
          {serverError ? <div className="form-error" role="alert">{serverError}</div> : null}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Подождите…' : 'Продолжить'}
          </button>
        </form>
      </section>
    </main>
  );
}
