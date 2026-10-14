// Live backend endpoint on Render
const API_URL = 'https://snackfify-backend.onrender.com/api/orders';

/**
 * Updates the quantity for a specific menu item.
 * @param {string} itemId - The ID of the item (e.g., 'donut', 'chai')
 * @param {number} delta - +1 to increase, -1 to decrease
 */
function updateCount(itemId, delta) {
    const countElement = document.getElementById(`${itemId}Count`);
    if (!countElement) return;

    let currentCount = parseInt(countElement.innerText, 10) || 0;
    currentCount += delta;

    if (currentCount < 0) {
        currentCount = 0;
    }

    countElement.innerText = currentCount;
    calculateTotal();
}

/**
 * Calculates the grand total based on current item counts and prices.
 */
function calculateTotal() {
    let total = 0;
    const menuItems = document.querySelectorAll('.menu-item');

    menuItems.forEach((item) => {
        const itemId = item.getAttribute('data-item-id');
        const price = parseFloat(item.getAttribute('data-price')) || 0;
        const countElement = document.getElementById(`${itemId}Count`);
        
        if (countElement) {
            const count = parseInt(countElement.innerText, 10) || 0;
            total += price * count;
        }
    });

    const totalPriceElement = document.getElementById('totalPrice');
    if (totalPriceElement) {
        totalPriceElement.innerText = total.toFixed(2);
    }
}

/**
 * Gathers form data and submits the order to the Render server.
 */
async function submitOrder() {
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const isParcelInput = document.getElementById('isParcel');
    const paymentInput = document.querySelector('input[name="payment"]:checked');

    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!name || !phone) {
        alert('Please enter your Name and Phone Number.');
        return;
    }

    // Collect items that have a quantity greater than 0
    const items = [];
    const menuItems = document.querySelectorAll('.menu-item');

    menuItems.forEach((item) => {
        const itemId = item.getAttribute('data-item-id');
        const price = parseFloat(item.getAttribute('data-price')) || 0;
        const itemName = item.querySelector('.item-name')?.innerText || itemId;
        const countElement = document.getElementById(`${itemId}Count`);
        const quantity = countElement ? parseInt(countElement.innerText, 10) || 0 : 0;

        if (quantity > 0) {
            items.push({
                id: itemId,
                name: itemName,
                quantity: quantity,
                price: price
            });
        }
    });

    if (items.length === 0) {
        alert('Please select at least one item to place an order.');
        return;
    }

    const orderPayload = {
        customerName: name,
        phone: phone,
        isParcel: isParcelInput ? isParcelInput.checked : false,
        paymentMethod: paymentInput ? paymentInput.value : 'UPI',
        items: items,
        totalPrice: parseFloat(document.getElementById('totalPrice').innerText) || 0
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderPayload)
        });

        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }

        const data = await response.json();
        alert('🎉 Order placed successfully!');
        console.log('Order confirmation from server:', data);

        // Optional: Reset form fields after successful order
        resetForm();
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('Could not connect to the server. If the server was sleeping, please wait a few seconds and try again.');
    }
}

/**
 * Resets the form inputs and item counts back to zero.
 */
function resetForm() {
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('isParcel').checked = false;

    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach((item) => {
        const itemId = item.getAttribute('data-item-id');
        const countElement = document.getElementById(`${itemId}Count`);
        if (countElement) {
            countElement.innerText = '0';
        }
    });

    calculateTotal();
}