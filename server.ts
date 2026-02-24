import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("orders.db");

// Initialize database
db.exec(`
  DROP TABLE IF EXISTS orders;
  DROP TABLE IF EXISTS customers;

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_commande TEXT NOT NULL,
    statut TEXT CHECK(statut IN ('Expédiée', 'Livrée')) NOT NULL,
    quantite INTEGER NOT NULL,
    email_client TEXT NOT NULL,
    prix_achat REAL NOT NULL,
    prix_vente REAL NOT NULL,
    nom_produit TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/customers", (req, res) => {
    try {
      const customers = db.prepare(`
        SELECT c.id, c.email, COUNT(o.id) as order_count 
        FROM customers c 
        LEFT JOIN orders o ON c.email = o.email_client 
        GROUP BY c.id, c.email
        ORDER BY c.email ASC
      `).all();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des clients." });
    }
  });

  app.post("/api/customers", (req, res) => {
    const { email } = req.body;
    try {
      const result = db.prepare("INSERT INTO customers (email) VALUES (?)").run(email);
      res.json({ id: result.lastInsertRowid });
    } catch (error: any) {
      console.error("Error creating customer:", error);
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "Cet email existe déjà." });
      } else {
        res.status(500).json({ error: "Erreur serveur." });
      }
    }
  });

  app.put("/api/customers/:id", (req, res) => {
    const { email } = req.body;
    const { id } = req.params;
    try {
      // Get old email to update orders
      const oldCustomer = db.prepare("SELECT email FROM customers WHERE id = ?").get(id) as any;
      if (oldCustomer) {
        db.transaction(() => {
          db.prepare("UPDATE orders SET email_client = ? WHERE email_client = ?").run(email, oldCustomer.email);
          db.prepare("UPDATE customers SET email = ? WHERE id = ?").run(email, id);
        })();
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Client non trouvé." });
      }
    } catch (error: any) {
      console.error("Error updating customer:", error);
      res.status(400).json({ error: "Erreur lors de la mise à jour." });
    }
  });

  app.delete("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    try {
      const customer = db.prepare("SELECT email FROM customers WHERE id = ?").get(id) as any;
      if (customer) {
        const orderCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE email_client = ?").get(customer.email) as any;
        if (orderCount.count > 0) {
          res.status(400).json({ error: "Impossible de supprimer un client ayant des commandes." });
        } else {
          db.prepare("DELETE FROM customers WHERE id = ?").run(id);
          res.json({ success: true });
        }
      } else {
        res.status(404).json({ error: "Client non trouvé." });
      }
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "Erreur serveur." });
    }
  });

  app.get("/api/orders", (req, res) => {
    try {
      const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des commandes." });
    }
  });

  app.post("/api/orders", (req, res) => {
    const { numero_commande, statut, quantite, email_client, prix_achat, prix_vente, nom_produit } = req.body;

    if (!numero_commande || !email_client || !nom_produit || !quantite) {
      return res.status(400).json({ error: "Tous les champs obligatoires doivent être remplis." });
    }

    try {
      // Insert customer if new
      db.prepare("INSERT OR IGNORE INTO customers (email) VALUES (?)").run(email_client);

      const result = db.prepare(`
        INSERT INTO orders (numero_commande, statut, quantite, email_client, prix_achat, prix_vente, nom_produit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(numero_commande, statut, quantite, email_client, prix_achat, prix_vente, nom_produit);

      res.json({ id: result.lastInsertRowid });
    } catch (error) {
      console.error("DETAILED DATABASE ERROR:", error);
      res.status(500).json({ error: "Erreur lors de la création de la commande en base de données." });
    }
  });

  app.delete("/api/orders/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ error: "Erreur lors de la suppression de la commande." });
    }
  });

  app.patch("/api/orders/:id/status", (req, res) => {
    const { status } = req.body;
    try {
      db.prepare("UPDATE orders SET statut = ? WHERE id = ?").run(status, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du statut." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
