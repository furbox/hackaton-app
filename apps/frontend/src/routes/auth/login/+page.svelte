<script lang="ts">
  import { api, type LoginData, type AuthResponse } from '$lib/api';
  import { auth } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  let formData = {
    email: '',
    password: '',
  };

  let errors: Record<string, string> = {};
  let loading = false;

  const handleSubmit = async () => {
    errors = {};
    loading = true;

    try {
      const data: LoginData = {
        email: formData.email,
        password: formData.password,
      };

      const response = await api.post<AuthResponse>('/api/auth/login', data);
      auth.login(response.access_token, response.user);
      goto('/dashboard');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('email_not_verified') || error.message.includes('verify your email')) {
          errors.general = 'Please verify your email before logging in';
        } else if (error.message.includes('invalid_credentials') || error.message.includes('Invalid email or password')) {
          errors.general = 'Invalid email or password';
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
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Or <a href="/auth/register" class="font-medium text-indigo-600 hover:text-indigo-500">create a new account</a>
      </p>
    </div>

    {#if errors.general}
      <div class="rounded-md bg-red-50 p-4">
        <p class="text-sm font-medium text-red-800">{errors.general}</p>
      </div>
    {/if}

    <form class="mt-8 space-y-6" on:submit|preventDefault={handleSubmit}>
      <div class="rounded-md shadow-sm -space-y-px">
        <div>
          <label for="email-address" class="sr-only">Email address</label>
          <input
            id="email-address"
            name="email"
            type="email"
            required
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Email address"
            bind:value={formData.email}
          />
        </div>
        <div>
          <label for="password" class="sr-only">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Password"
            bind:value={formData.password}
          />
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div class="text-sm">
          <a href="/auth/forgot-password" class="font-medium text-indigo-600 hover:text-indigo-500">
            Forgot your password?
          </a>
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
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    </form>
  </div>
</div>
