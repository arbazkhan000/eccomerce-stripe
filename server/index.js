import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import Stripe from "stripe";

dotenv.config();
const app = express();
const port = process.env.PORT || 2222;

// Middleware
const corsOptions = {
    origin:process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Order Route
app.post("/order", async (req, res) => {
    try {
        const { items, address } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart is empty",
            });
        }

        if (!address) {
            return res.status(400).json({
                success: false,
                message: "Address is required",
            });
        }

        // Validate items format
        for (const item of items) {
            if (!item.id || !item.name || !item.price || !item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid item format in cart",
                });
            }
        }

        // Initialize Stripe with secret key from environment variables
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: items.map((item) => ({
                price_data: {
                    currency: "inr",
                    product_data: {
                        name: item.name,
                    },
                    unit_amount: Math.round(item.price * 100), // Amount in paise, ensure integer
                },
                quantity: item.quantity,
            })),
            mode: "payment",
            success_url: `${process.env.FRONTEND_URL}/success`,
            cancel_url: `${process.env.FRONTEND_URL}/payment/error`,
            metadata: {
                address: address.substring(0, 500), // Limit metadata size
            },
        });

        res.status(200).json({
            success: true,
            id: session.id,
        });
    } catch (error) {
        console.error("Stripe Error:", error);

        // Send appropriate error messages without exposing sensitive details
        if (error.type === "StripeCardError") {
            return res.status(400).json({
                success: false,
                message:
                    "Your card was declined. Please try with a different payment method.",
            });
        }

        res.status(500).json({
            success: false,
            message: "Payment processing failed. Please try again later.",
        });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
        success: false,
        message: "Internal Server Error",
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
