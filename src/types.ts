export type OrderStatus = 'Expédiée' | 'Livrée';

export interface Customer {
  id: number;
  email: string;
  order_count: number;
}

export interface Order {
  id: number;
  numero_commande: string;
  statut: OrderStatus;
  quantite: number;
  email_client: string;
  prix_achat: number;
  prix_vente: number;
  nom_produit: string;
  created_at: string;
}

export interface OrderFormData {
  numero_commande: string;
  statut: OrderStatus;
  quantite: number;
  email_client: string;
  prix_achat: number;
  prix_vente: number;
  nom_produit: string;
}
