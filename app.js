```javascript
const menuContainer = document.getElementById("menu-items");
const categoriesContainer = document.getElementById("categories");
const searchInput = document.getElementById("search");
const cartContainer = document.getElementById("cart-items");
const cartCount = document.getElementById("cart-count");
const cartTotal = document.getElementById("cart-total");
const checkoutForm = document.getElementById("checkout-form");
const orderMessage = document.getElementById("order-message");
const trackingForm = document.getElementById("tracking-form");
const trackingResult = document.getElementById("tracking-result");

let menuItems = [];
let cart = [];
let selectedCategory = "All";

async function loadMenu() {
    menuContainer.textContent = "Loading menu...";

    try {
        const response = await fetch("/api/menu");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not load menu.");
        }

        menuItems = data;
        renderCategories();
        renderMenu();
    } catch (error) {
        menuContainer.textContent =
            "Could not load the menu. Check your database setup.";
        console.error("Menu loading error:", error);
    }
}

function renderCategories() {
    const categories = [
        "All",
        ...new Set(menuItems.map(item => item.category).filter(Boolean))
    ];

    categoriesContainer.replaceChildren();

    categories.forEach(category => {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
            "category-button" +
            (selectedCategory === category ? " active" : "");
        button.textContent = category;

        button.addEventListener("click", () => {
            selectedCategory = category;
            renderCategories();
            renderMenu();
        });

        categoriesContainer.appendChild(button);
    });
}

function renderMenu() {
    menuContainer.replaceChildren();

    const searchTerm = searchInput.value.trim().toLowerCase();

    const filteredItems = menuItems.filter(item => {
        const matchesCategory =
            selectedCategory === "All" ||
            item.category === selectedCategory;

        const matchesSearch =
            String(item.name || "").toLowerCase().includes(searchTerm) ||
            String(item.description || "").toLowerCase().includes(searchTerm);

        return matchesCategory && matchesSearch;
    });

    if (filteredItems.length === 0) {
        menuContainer.textContent = "No menu items found.";
        return;
    }

    filteredItems.forEach(item => {
        const card = document.createElement("article");
        card.className = "menu-card";

        const name = document.createElement("h3");
        name.textContent = item.name;

        const description = document.createElement("p");
        description.textContent = item.description || "Delicious and freshly prepared.";

        const price = document.createElement("p");
        price.className = "price";
        price.textContent = `₹${Number(item.price).toFixed(2)}`;

        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "add-button";
        addButton.textContent = "Add to Cart";
        addButton.addEventListener("click", () => addToCart(item.id));

        card.append(name, description, price, addButton);
        menuContainer.appendChild(card);
    });
}

function addToCart(itemId) {
    const item = menuItems.find(menuItem => menuItem.id === itemId);

    if (!item) {
        alert("This menu item is unavailable.");
        return;
    }

    const existing = cart.find(cartItem => cartItem.id === itemId);

    if (existing) {
        if (existing.quantity >= 20) {
            alert("Maximum quantity is 20 per item.");
            return;
        }

        existing.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }

    renderCart();
}

function renderCart() {
    cartContainer.replaceChildren();

    if (cart.length === 0) {
        cartContainer.textContent = "Your cart is empty.";
    }

    cart.forEach(item => {
        const row = document.createElement("div");
        row.className = "cart-row";

        const description = document.createElement("span");
        description.textContent =
            `${item.name} × ${item.quantity} — ₹` +
            (Number(item.price) * item.quantity).toFixed(2);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-button";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => {
            cart = cart.filter(cartItem => cartItem.id !== item.id);
            renderCart();
        });

        row.append(description, removeButton);
        cartContainer.appendChild(row);
    });

    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
    );

    cartCount.textContent = count;
    cartTotal.textContent = total.toFixed(2);
}

searchInput.addEventListener("input", renderMenu);

checkoutForm.addEventListener("submit", async event => {
    event.preventDefault();
    orderMessage.textContent = "";

    if (cart.length === 0) {
        orderMessage.textContent = "Please add items to your cart first.";
        return;
    }

    const submitButton = checkoutForm.querySelector(
        'button[type="submit"]'
    );
    submitButton.disabled = true;
    submitButton.textContent = "Placing order...";

    const payload = {
        customer_name: document.getElementById("customer-name").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        address: document.getElementById("address").value.trim(),
        items: cart.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity
        }))
    };

    try {
        const response = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not place your order.");
        }

        const order = result.order;
        orderMessage.textContent =
            `${result.message} Order details: ${JSON.stringify(order)}`;

        cart = [];
        renderCart();
        checkoutForm.reset();
    } catch (error) {
        orderMessage.textContent = error.message;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Place Order";
    }
});

trackingForm.addEventListener("submit", async event => {
    event.preventDefault();
    trackingResult.textContent = "Checking your order...";

    const orderNumber = document.getElementById("order-number").value.trim();

    try {
        const response = await fetch(
            `/api/orders/${encodeURIComponent(orderNumber)}`
        );
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not find your order.");
        }

        trackingResult.textContent =
            `Status: ${result.status} | Total: ₹${Number(result.total_amount).toFixed(2)}`;
    } catch (error) {
        trackingResult.textContent = error.message;
    }
});

loadMenu();
renderCart();
```