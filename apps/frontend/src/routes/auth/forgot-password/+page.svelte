<script lang="ts">
  import { api } from '$lib/api';

  let email = '';
  let loading = false;
  let successMessage = '';
  let errorMessage = '';

  const handleSubmit = async () => {
    if (!email) {
      errorMessage = 'Please enter your email address';
      return;
    }

    loading = true;
    successMessage = '';
    errorMessage = '';

    try {
      await api.post('/api/auth/forgot-password', { email });
      successMessage = 'If an account exists with this email, a password reset link has been sent.';
      email = '';
    } catch (error) {
      if (error instanceof Error) {
        errorMessage = error.message;
      }
    } finally {
      loading = false;
    }
  };
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Reset your password</h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Enter your email address and we'll send you a link to reset your password
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

    {#if errorMessage}
      <div class="rounded-md bg-red-50 p-4">
        <p class="text-sm font-medium text-red-800">{errorMessage}</p>
      </div>
    {/if}

    <form class="mt-8 space-y-6" on:submit|preventDefault={handleSubmit}>
      <div>
        <label for="email-address" class="sr-only">Email address</label>
        <input
          id="email-address"
          name="email"
          type="email"
          required
          class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
          placeholder="Email address"
          bind:value={email}
        />
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
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </div>

      <div class="text-center">
        <a href="/auth/login" class="font-medium text-indigo-600 hover:text-indigo-500">
          Back to login
        </a>
      </div>
    </form>
  </div>
</div>
