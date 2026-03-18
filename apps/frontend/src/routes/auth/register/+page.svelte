<script lang="ts">
  import { api, type RegisterData } from '$lib/api';
  import { goto } from '$app/navigation';

  let formData = {
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  };

  let errors: Record<string, string> = {};
  let loading = false;
  let successMessage = '';

  const validateForm = () => {
    errors = {};

    if (!formData.username || formData.username.length < 3 || formData.username.length > 30) {
      errors.username = 'Username must be 3-30 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain at least 1 uppercase letter and 1 digit';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    loading = true;
    successMessage = '';

    try {
      const data: RegisterData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      };

      await api.post('/api/auth/register', data);
      successMessage = 'Registration successful! Please check your email to verify your account.';
      formData = { username: '', email: '', password: '', confirmPassword: '' };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('email_already_exists') || error.message.includes('Email already registered')) {
          errors.email = 'Email already registered';
        } else if (error.message.includes('username_already_exists') || error.message.includes('Username already taken')) {
          errors.username = 'Username already taken';
        } else {
          errors.general = error.message;
        }
      }
    } finally {
      loading = false;
    }
  };
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Create your account</h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Or <a href="/auth/login" class="font-medium text-indigo-600 hover:text-indigo-500">sign in</a> if you already have one
      </p>
    </div>

    {#if successMessage}
      <div class="rounded-md bg-green-50 p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-green-800">{successMessage}</p>
          </div>
        </div>
      </div>
    {/if}

    {#if errors.general}
      <div class="rounded-md bg-red-50 p-4">
        <p class="text-sm font-medium text-red-800">{errors.general}</p>
      </div>
    {/if}

    <form class="mt-8 space-y-6" on:submit|preventDefault={handleSubmit}>
      <div class="rounded-md shadow-sm -space-y-px">
        <div>
          <label for="username" class="sr-only">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            required
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Username"
            bind:value={formData.username}
            class:ring-red-500={errors.username}
            class:border-red-500={errors.username}
          />
          {#if errors.username}
            <p class="mt-1 text-sm text-red-600">{errors.username}</p>
          {/if}
        </div>
        <div>
          <label for="email-address" class="sr-only">Email address</label>
          <input
            id="email-address"
            name="email"
            type="email"
            required
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Email address"
            bind:value={formData.email}
            class:ring-red-500={errors.email}
            class:border-red-500={errors.email}
          />
          {#if errors.email}
            <p class="mt-1 text-sm text-red-600">{errors.email}</p>
          {/if}
        </div>
        <div>
          <label for="password" class="sr-only">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Password"
            bind:value={formData.password}
            class:ring-red-500={errors.password}
            class:border-red-500={errors.password}
          />
          {#if errors.password}
            <p class="mt-1 text-sm text-red-600">{errors.password}</p>
          {/if}
        </div>
        <div>
          <label for="confirm-password" class="sr-only">Confirm Password</label>
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            required
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Confirm Password"
            bind:value={formData.confirmPassword}
            class:ring-red-500={errors.confirmPassword}
            class:border-red-500={errors.confirmPassword}
          />
          {#if errors.confirmPassword}
            <p class="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
          {/if}
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if loading}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {/if}
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </div>
    </form>
  </div>
</div>
