require("dotenv").config();

const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    console.error("Missing Supabase settings. Check your .env file.");
    process.exit(1);
}

// Connect to Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Test whether the backend is running
app.get("/api/health", (req, res) => {
    res.json({ message: "Restaurant API is running!" });
});

// Get all available menu items
app.get("/api/menu", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("menu_items")
            .select("id, name, description, category, price, image_url")
            .eq("is_available", true)
            .order("id");

        if (error) {
            console.error("Menu error:", error.message);
            return res.status(500).json({
                error: "Could not load the menu."
            });
        }

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error." });
    }
});

// Place a new order
app.post("/api/orders", async (req, res) => {
    try {
        const { customer_name, phone, address, items } = req.body;

        // Validate customer details
        if (
            typeof customer_name !== "string" ||
            typeof phone !== "string" ||
            typeof address !== "string" ||
            !customer_name.trim() ||
            !phone.trim() ||
            !address.trim()
        ) {
            return res.status(400).json({
                error: "Please enter your name, phone number, and address."
            });
        }

        // Basic phone validation
        if (!/^[0-9+\-\s()]{7,20}$/.test(phone.trim())) {
            return res.status(400).json({
                error: "Please enter a valid phone number."
            });
        }

        // Validate cart
        if (
            !Array.isArray(items) ||
            items.length === 0 ||
            items.length > 30
        ) {
            return res.status(400).json({
                error: "Your cart is empty or contains too many different items."
            });
        }

        // Validate item IDs and quantities
        const cleanItems = [];

        for (const item of items) {
            const menuItemId = Number(item.menu_item_id);
            const quantity = Number(item.quantity);

            if (
                !Number.isSafeInteger(menuItemId) ||
                menuItemId <= 0 ||
                !Number.isInteger(quantity) ||
                quantity < 1 ||
                quantity > 20
            ) {
                return res.status(400).json({
                    error: "Invalid menu item or quantity."
                });
            }

            cleanItems.push({
                menu_item_id: menuItemId,
                quantity: quantity
            });
        }

        // Database function calculates the actual order price
        const { data, error } = await supabase.rpc(
            "create_restaurant_order",
            {
                p_customer_name: customer_name.trim(),
                p_phone: phone.trim(),
                p_address: address.trim(),
                p_items: cleanItems
            }
        );

        if (error) {
            console.error("Order error:", error.message);

            return res.status(400).json({
                error: "Could not place your order. Please check the database setup."
            });
        }

        res.status(201).json({
            message: "Your order has been placed successfully!",
            order: data
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Something went wrong while placing your order."
        });
    }
});

// Check an order using its order number
app.get("/api/orders/:orderNumber", async (req, res) => {
    try {
        const orderNumber = req.params.orderNumber;

        // Validate UUID format
        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidPattern.test(orderNumber)) {
            return res.status(400).json({
                error: "Invalid order number."
            });
        }

        const { data, error } = await supabase
            .from("orders")
            .select(`
                order_number,
                total_amount,
                status,
                created_at,
                order_items (
                    item_name,
                    quantity,
                    price_each,
                    subtotal
                )
            `)
            .eq("order_number", orderNumber)
            .maybeSingle();

        if (error) {
            console.error("Order lookup error:", error.message);
            return res.status(500).json({
                error: "Could not check your order."
            });
        }

        if (!data) {
            return res.status(404).json({
                error: "Order not found."
            });
        }

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error." });
    }
});

app.listen(PORT, () => {
    console.log("Restaurant app running at http://localhost:" + PORT);
});
