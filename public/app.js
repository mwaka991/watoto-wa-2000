const overlay = document.getElementById('overlay');
const video = document.getElementById('previewVideo');
const paymentForm = document.getElementById('paymentForm');
const phoneInput = document.getElementById('phone');
const statusEl = document.getElementById('status');
const payButton = document.getElementById('payButton');

// Ensure video autoplays when page loads
window.addEventListener('load', () => {
  video.play().catch(err => {
    console.log('Autoplay prevented, waiting for user interaction');
  });
});

// Resume playback if user interacts with page
document.addEventListener('click', () => {
  if (video.paused) {
    video.play().catch(err => {
      console.log('Play failed');
    });
  }
}, { once: true });

const POLL_INTERVAL_MS = 3500;
const TIMEOUT_MS = 2 * 60 * 1000;
let pollTimer = null;
let pollTimeout = null;
let currentOrderRef = null;
let isChecking = false;

function showOverlay() {
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function showStatus(message, variant = 'info') {
  statusEl.textContent = message;
  statusEl.className = `status ${variant}`;
  statusEl.classList.remove('hidden');
}

function hideStatus() {
  statusEl.textContent = '';
  statusEl.className = 'status hidden';
}

function setLoading(loading) {
  payButton.disabled = loading;
  phoneInput.disabled = loading;
}

async function startPayment(phone) {
  setLoading(true);
  hideStatus();
  showStatus('Sending payment prompt to your phone...', 'info');

  try {
    const response = await fetch('/api/pay/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
      credentials: 'same-origin',
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unable to start payment.');
    }

    currentOrderRef = data.orderRef;
    beginPolling();
  } catch (error) {
    showStatus(error.message || 'Unable to initiate payment.', 'error');
    setLoading(false);
  }
}

function beginPolling() {
  const startTime = Date.now();
  setLoading(true);
  showStatus('Waiting for payment confirmation...', 'info');

  async function poll() {
    if (!currentOrderRef) {
      return;
    }

    if (Date.now() - startTime >= TIMEOUT_MS) {
      showStatus('Timeout reached. Please check your phone and try again.', 'error');
      setLoading(false);
      return;
    }

    if (isChecking) {
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      return;
    }

    isChecking = true;
    try {
      const response = await fetch(`/api/pay/status/${encodeURIComponent(currentOrderRef)}`, {
        credentials: 'same-origin',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to check payment status.');
      }

      if (data.status === 'paid') {
        showStatus('Payment confirmed. Redirecting...', 'success');
        window.location.href = 'https://chombezo.online';
        return;
      }

      if (data.status === 'failed') {
        showStatus(data.message || 'Payment failed. Please try again.', 'error');
        setLoading(false);
        return;
      }

      showStatus('Waiting for payment confirmation...', 'info');
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    } catch (error) {
      showStatus(error.message || 'Unable to check payment status.', 'error');
      setLoading(false);
    } finally {
      isChecking = false;
    }
  }

  poll();
}

paymentForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const phone = phoneInput.value.trim();
  if (!phone) {
    showStatus('Please enter a Tanzanian phone number.', 'error');
    return;
  }
  startPayment(phone);
});

phoneInput.addEventListener('input', () => {
  phoneInput.setCustomValidity('');
});

phoneInput.addEventListener('invalid', () => {
  phoneInput.setCustomValidity('Please enter a valid Tanzanian phone number (10 digits starting with 0 or international format).');
});

video.addEventListener('loadedmetadata', () => {
  if (video.paused) {
    video.play().catch(() => {});
  }
});

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    showOverlay();
  }, 5000);
});
