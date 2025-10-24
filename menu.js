function updateCount(itemId, change) {
    const countElement = document.getElementById(itemId + 'Count');
    let currentCount = parseInt(countElement.innerText);
    let newCount = Math.max(0, currentCount + change);
    
    countElement.innerText = newCount;
    updateTotal();
}

function updateTotal() {
    let total = 0;
    const items = document.querySelectorAll('.menu-item');

    items.forEach(item => {
        const price = parseFloat(item.dataset.price);
        const quantity = parseInt(document.getElementById(item.dataset.itemId + 'Count').innerText);
        total += price * quantity;
    });

    document.getElementById('totalPrice').innerText = total.toFixed(2);
}

async function submitOrder() {
    const selectedPayment = document.querySelector('input[name="payment"]:checked');
    
    const orderData = {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        isParcel: document.getElementById('isParcel').checked,
        paymentMethod: selectedPayment ? selectedPayment.value : null,
        totalPrice: parseFloat(document.getElementById('totalPrice').innerText),
        items: {}
    };

    if (!orderData.name || !orderData.phone) {
        alert('Please enter your name and phone number.');
        return;
    }
    if (orderData.totalPrice === 0) {
        alert('Your cart is empty.');
        return;
    }
    if (!orderData.paymentMethod) {
        alert('Please select a payment method.');
        return;
    }

    document.querySelectorAll('.menu-item').forEach(item => {
        const itemId = item.dataset.itemId;
        const quantity = parseInt(document.getElementById(itemId + 'Count').innerText);
        if (quantity > 0) {
            orderData.items[itemId] = quantity;
        }
    });

    try {
        const response = await fetch('/submit-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
        });

        const result = await response.json();
        alert(result.message);

        if (response.ok) {
            window.location.reload();
        }
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('There was a connection error. Please try again.');
    }
}