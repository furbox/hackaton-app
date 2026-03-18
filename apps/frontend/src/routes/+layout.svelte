<script>
  import '../app.css';
  import Toast from '../lib/components/Toast.svelte';
  import Navbar from '../lib/components/Navbar.svelte';
</script>

<Navbar />

<slot />

<Toast />
