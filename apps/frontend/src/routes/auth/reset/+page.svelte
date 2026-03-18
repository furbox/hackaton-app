<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  let token = '';
  let formData = {
    newPassword: '',
    confirmPassword: '',
  };

  let loading = false;
  let success = false;
  let errors: Record<string, string> = '';
  let errorMessage = '';

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token') || '';

    if (!token) {
      errorMessage = 'No reset token provided';
    }
  });

  const validateForm = () => {
    errors = {};

    if (!formData.newPassword) {
      errors.newPassword = 'Password is required';
    } else if (formData.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      errors.newPassword = 'Password must contain at least 1 uppercase letter and 1 digit';
    }

    if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    loading = true;
    errorMessage = '';

    try {
      await api.post('/api/auth/reset-password', {
        token,
        newPassword: formData.newPassword,
      });
      success = true;
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
    {#if success}
      <div class="rounded-md bg-green-50 p-8">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-12 w-12 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-medium text-green-800">Password Reset Successful!</h3>
            <div class="mt-2">
              <p class="text-sm text-green-700">Your password has been reset successfully. You can now log in with your new password.</p>
            </div>
            <div class="mt-6">
              <a
                href="/auth/login"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Go to Login
              </a>
            </div>
          </div>
        </div>
      </div>
    {:else}
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Reset your password</h2>
        <p class="mt-2 text-center text-sm text-gray-600">Enter your new password below</p>
      </div>

      {#if errorMessage}
        <div class="rounded-md bg-red-50 p-4">
          <p class="text-sm font-medium text-red-800">{errorMessage}</p>
        </div>
      {/if}

      {#if token}
        <form class="mt-8 space-y-6" on:submit|preventDefault={handleSubmit}>
          <div class="rounded-md shadow-sm -space-y-px">
            <div>
              <label for="new-password" class="sr-only">New Password</label>
              <input
                id="new-password"
                name="new-password"
                type="password"
                required
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="New Password"
                bind:value={formData.newPassword}
                class:ring-red-500={errors.newPassword}
                class:border-red-500={errors.newPassword}
              />
              {#if errors.newPassword}
                <p class="mt-1 text-sm text-red-600">{errors.newPassword}</p>
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
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </div>
        </form>
      {/if}
    {/if}
  </div>
</div>
