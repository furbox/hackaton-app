<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  let token = '';
  let loading = true;
  let success = false;
  let errorMessage = '';

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token') || '';

    if (!token) {
      errorMessage = 'No verification token provided';
      loading = false;
      return;
    }

    verifyEmail();
  });

  async function verifyEmail() {
    try {
      await api.get(`/api/auth/verify?token=${token}`);
      success = true;
    } catch (error) {
      if (error instanceof Error) {
        errorMessage = error.message;
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full">
    {#if loading}
      <div class="text-center">
        <svg class="animate-spin -ml-1 mr-3 h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="mt-4 text-gray-600">Verifying your email...</p>
      </div>
    {:else if success}
      <div class="rounded-md bg-green-50 p-8">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-12 w-12 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-medium text-green-800">Email Verified!</h3>
            <div class="mt-2">
              <p class="text-sm text-green-700">Your email has been verified successfully. You can now log in to your account.</p>
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
      <div class="rounded-md bg-red-50 p-8">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-12 w-12 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-medium text-red-800">Verification Failed</h3>
            <div class="mt-2">
              <p class="text-sm text-red-700">{errorMessage || 'Unable to verify your email. The link may be invalid or expired.'}</p>
            </div>
            <div class="mt-6">
              <a
                href="/auth/login"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Back to Login
              </a>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
