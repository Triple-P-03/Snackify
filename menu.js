(() => {
    'use strict';

    const form = document.getElementById('orderForm');
    const fields = document.getElementById('orderFields');
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const parcelInput = document.getElementById('isParcel');
    const submitButton = document.getElementById('submitOrder');
    const totalElement = document.getElementById('totalPrice');
    const statusElement = document.getElementById('orderStatus');
    const uncertainWarning = document.getElementById('uncertainWarning');
    const configuredUrl = window.SNACKIFY_CONFIG?.ordersApiUrl;
    const apiUrl = typeof configuredUrl === 'string' ? configuredUrl.trim() : '';
    const maximumQuantity = 99;
    const requestTimeoutMs = 30000;
    let isReady = false;
    let isSubmitting = false;

    const menuItems = Array.from(form.querySelectorAll('.menu-item'), (element) => {
        const [rupees, paise = ''] = element.dataset.price.split('.');
        return {
            id: element.dataset.itemId,
            name: element.querySelector('.item-name').textContent.trim(),
            // Keep calculations in integer paise; convert only for display and the API.
            priceInPaise: Number(rupees) * 100 + Number(paise.padEnd(2, '0')),
            quantity: 0,
            countElement: element.querySelector('.quantity-value'),
            decreaseButton: element.querySelector('[data-delta="-1"]'),
            increaseButton: element.querySelector('[data-delta="1"]')
        };
    });

    function showStatus(message, state) {
        statusElement.textContent = message;
        statusElement.dataset.state = state;
    }

    function warnUncertainOutcome() {
        uncertainWarning.hidden = false;
        submitButton.setAttribute('aria-describedby', 'orderStatus uncertainWarning');
    }

    function totalInPaise() {
        return menuItems.reduce((total, item) => total + item.priceInPaise * item.quantity, 0);
    }

    function renderCart() {
        menuItems.forEach((item) => {
            item.countElement.textContent = String(item.quantity);
            item.decreaseButton.disabled = item.quantity === 0;
            item.increaseButton.disabled = item.quantity === maximumQuantity;
        });
        totalElement.textContent = (totalInPaise() / 100).toFixed(2);
    }

    function updateCount(item, delta) {
        if (!isReady || isSubmitting) return;
        item.quantity = Math.max(0, Math.min(maximumQuantity, item.quantity + delta));
        renderCart();
    }

    function setSubmitting(submitting) {
        isSubmitting = submitting;
        fields.disabled = submitting;
        submitButton.disabled = submitting;
        submitButton.textContent = submitting ? 'Submitting…' : 'Submit Order';
        form.setAttribute('aria-busy', String(submitting));
    }

    async function submitOrder(event) {
        event.preventDefault();
        if (!isReady || isSubmitting) return;

        const customerName = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        const digitCount = phone.replace(/\D/g, '').length;
        const validPhone = /^\+?[0-9\s().-]+$/.test(phone) && digitCount >= 7 && digitCount <= 15;
        nameInput.setCustomValidity(customerName ? '' : 'Please enter your name.');
        phoneInput.setCustomValidity(validPhone ? '' : 'Enter a phone number with 7–15 digits, using only a leading +, spaces, parentheses, dots or hyphens for formatting.');
        nameInput.setAttribute('aria-invalid', String(!customerName));
        phoneInput.setAttribute('aria-invalid', String(!validPhone));

        if (!form.checkValidity()) {
            const firstInvalid = form.querySelector('input:invalid');
            showStatus(firstInvalid.validationMessage || 'Please check the required fields.', 'error');
            form.reportValidity();
            return;
        }

        const items = menuItems.filter((item) => item.quantity > 0).map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.priceInPaise / 100
        }));

        if (items.length === 0) {
            showStatus('Please choose at least one item to place an order.', 'error');
            menuItems[0].increaseButton.focus();
            return;
        }

        const orderPayload = {
            customerName,
            phone,
            isParcel: parcelInput.checked,
            paymentMethod: form.querySelector('input[name="payment"]:checked').value,
            items,
            totalPrice: totalInPaise() / 100
        };

        const controller = new AbortController();
        let timedOut = false;
        setSubmitting(true);
        showStatus('Submitting your order. Please wait…', 'pending');
        const timeoutId = window.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, requestTimeoutMs);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload),
                signal: controller.signal
            });

            if (!response.ok) {
                // Never render the server body: it may contain HTML or private details.
                if (response.status >= 500 || response.status === 408) {
                    warnUncertainOutcome();
                }
                showStatus(`The order service returned an error (HTTP ${response.status}). Your details have been kept. Please check before submitting again.`, 'error');
                return;
            }

            // Any HTTP success is sufficient; JSON and empty responses both work.
            resetForm();
            showStatus('Order placed successfully! Your form is ready for a new order.', 'success');
        } catch {
            warnUncertainOutcome();
            const reason = timedOut ? 'The request timed out after 30 seconds.' : 'There was a connection problem.';
            showStatus(`${reason} We could not confirm your order. Your details have been kept, and the order may already have been received. Check whether it was placed before submitting again.`, 'error');
        } finally {
            window.clearTimeout(timeoutId);
            setSubmitting(false);
            statusElement.focus();
        }
    }

    function resetForm() {
        form.reset();
        [nameInput, phoneInput].forEach((input) => {
            input.setCustomValidity('');
            input.removeAttribute('aria-invalid');
        });
        menuItems.forEach((item) => {
            item.quantity = 0;
        });
        uncertainWarning.hidden = true;
        submitButton.setAttribute('aria-describedby', 'orderStatus');
        renderCart();
    }

    form.addEventListener('submit', submitOrder);
    [nameInput, phoneInput].forEach((input) => {
        input.addEventListener('input', () => {
            input.setCustomValidity('');
            input.removeAttribute('aria-invalid');
        });
    });
    menuItems.forEach((item) => {
        item.decreaseButton.addEventListener('click', () => updateCount(item, -1));
        item.increaseButton.addEventListener('click', () => updateCount(item, 1));
    });

    try {
        const endpoint = new URL(apiUrl);
        if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') {
            throw new Error('Unsupported order endpoint');
        }
    } catch {
        showStatus('Ordering is unavailable because its configuration could not be loaded. Please reload this page.', 'error');
        return;
    }

    if (typeof window.fetch !== 'function' || typeof window.AbortController !== 'function') {
        showStatus('Ordering requires an up-to-date browser. Please update your browser and reload this page.', 'error');
        return;
    }

    renderCart();
    isReady = true;
    setSubmitting(false);
    showStatus('Choose your items and enter your details to place an order.', 'ready');
})();
