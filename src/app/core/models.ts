export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number; }

export interface Category { id: number; name: string; slug: string; imageUrl?: string; description?: string; productCount: number; }
export interface Collection { id: number; name: string; slug: string; imageUrl?: string; productCount: number; }

export interface ProductCard {
  id: number; name: string; slug: string; imageUrl?: string; thumbnailUrl?: string; mrp: number; price: number; discountPercent: number;
  ratingAverage: number; ratingCount: number; isAvailable: boolean; categoryName: string; categorySlug: string; tags: string[]; hasVariants: boolean; colors: string[];
  /** Price before the festival offer (equals price when there is none). */
  regularPrice: number; offerName?: string; offerSlug?: string; offerColor?: string;
}

/** A festival offer such as "Diwali Offers". */
export interface Offer {
  id: number; name: string; slug: string; tagline?: string; description?: string; bannerImageUrl?: string; themeColor: string;
  startsAt: string; endsAt: string; status: 'live' | 'upcoming' | 'ended' | 'off'; discountType: number; value: number; maxDiscount?: number;
  couponCode?: string; productCount: number; products: ProductCard[];
}
export interface ProductOffer { name: string; slug: string; tagline?: string; themeColor: string; endsAt: string; couponCode?: string; }

export interface ProductImage { id: number; url: string; thumbnailUrl?: string; altText?: string; mediaType: number; variantId?: number; }
export interface OptionValue { id: number; value: string; colorCode?: string; }
export interface ProductOption { id: number; name: string; values: OptionValue[]; isColour: boolean; }
export interface Variant { id: number; name: string; mrp: number; price: number; isAvailable: boolean; optionValueIds: number[]; regularPrice: number; }

export interface ProductDetail {
  id: number; name: string; slug: string; description?: string; descriptionHtml?: string; mrp: number; price: number; discountPercent: number; isAvailable: boolean;
  ratingAverage: number; ratingCount: number; category: Category; brand?: string; sku?: string; hsnCode?: string; gstRate: number;
  material?: string; dimensions?: string; warranty?: string; deliveryDays: number; assemblyIncluded: boolean;
  images: ProductImage[]; options: ProductOption[]; variants: Variant[]; tags: string[]; collections: Collection[]; metaTitle?: string; metaDescription?: string;
  regularPrice: number; offer?: ProductOffer;
}

export interface FacetItem { key: string; label: string; count: number; extra?: string; }
export interface Facets { priceMin: number; priceMax: number; categories: FacetItem[]; colors: FacetItem[]; sizes: FacetItem[]; collections: FacetItem[]; }

export interface Banner { id: number; title: string; subtitle?: string; imageUrl: string; linkUrl?: string; buttonText?: string; }
export interface Home { banners: Banner[]; categories: Category[]; featured: ProductCard[]; newArrivals: ProductCard[]; bestDeals: ProductCard[]; collections: Collection[]; offers?: Offer[]; }

export interface MyReviewStatus { canReview: boolean; orderNumber?: string; reviewed: boolean; }
export interface Review { id: number; userName: string; rating: number; title?: string; comment?: string; isVerifiedPurchase: boolean; createdAt: string; }

export interface SiteSettings {
  businessName: string; tagline?: string; phone: string; whatsApp?: string; email: string; address: string; shippingFee: number; freeShippingThreshold: number;
  codEnabled: boolean; codFee: number; codMaxOrderAmount: number; onlinePaymentEnabled: boolean; razorpayKeyId?: string;
  instagramUrl?: string; facebookUrl?: string; youtubeUrl?: string; defaultDeliveryDays: number;
  /** Google Maps browser key — only present when maps are switched on in Admin. */
  mapsApiKey?: string | null;
}

export interface PincodeCheck { pincode: string; serviceable: boolean; deliveryDays: number; extraCharge: number; codAvailable: boolean; area?: string; message: string; nearBengaluru?: boolean; }

export interface CartLine { productId: number; variantId?: number | null; quantity: number; }
export interface QuoteLine {
  productId: number; variantId?: number; name: string; variantName?: string; slug: string; imageUrl?: string; quantity: number;
  unitMrp: number; unitPrice: number; lineTotal: number; isAvailable: boolean; problem?: string; regularPrice: number; offerName?: string;
}
export interface Quote {
  lines: QuoteLine[]; subTotal: number; mrpTotal: number; discount: number; couponCode?: string; couponMessage?: string; shippingFee: number; codFee: number;
  total: number; taxAmount: number; canCheckout: boolean; codAvailable: boolean; deliveryDays: number; messages: string[]; offerSavings: number;
}

export type PaymentMethod = 'CashOnDelivery' | 'Razorpay' | 'BankTransfer' | 'Upi' | 'Card' | 'NetBanking' | 'Wallet' | 'Emi';

export interface CheckoutMethod { method: PaymentMethod; label: string; description?: string; provider: string; }

export interface PaymentInstructions {
  provider: 'DirectUpi' | 'BankTransfer'; amount: number; upiId?: string; payeeName?: string; upiUri?: string;
  accountName?: string; accountNumber?: string; ifsc?: string; bankName?: string; customerUtr?: string; awaitingVerification: boolean;
}
export type OrderStatus = 'Pending' | 'Confirmed' | 'PlacedWithVendor' | 'Dispatched' | 'OutForDelivery' | 'Delivered' | 'Cancelled' | 'Returned';

export interface Address { id: number; label: string; fullName: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string; isDefault: boolean; latitude?: number | null; longitude?: number | null; }

export interface PlaceOrderResponse {
  orderNumber: string; total: number; paymentMethod: PaymentMethod; razorpayOrderId?: string; razorpayKeyId?: string; amountInPaise: number;
  customerName: string; customerEmail?: string; customerPhone: string; accessToken: string; isGuest: boolean;
  paymentProvider?: string; gatewayMethod?: string;
}

export interface OrderSummary { id: number; orderNumber: string; createdAt: string; status: OrderStatus; paymentStatus: string; paymentMethod: PaymentMethod; total: number; itemCount: number; firstItemImage?: string; firstItemName?: string;
  expectedDeliveryDate?: string; deliveryDateChangedAt?: string; }

/** The customer's own review of a product in an order (approved or waiting). */
export interface OrderReview { productId: number; rating: number; title?: string; comment?: string; isApproved: boolean; writtenAt: string; }

export interface OrderDetail {
  id: number; orderNumber: string; createdAt: string; status: OrderStatus; paymentStatus: string; paymentMethod: PaymentMethod;
  shipName: string; shipPhone: string; shipEmail?: string; shipLine1: string; shipLine2?: string; shipLandmark?: string; shipCity: string; shipState: string; shipPincode: string;
  subTotal: number; discount: number; couponCode?: string; shippingFee: number; codFee: number; total: number; taxAmount: number; amountPaid: number;
  customerNotes?: string; expectedDeliveryDate?: string; deliveredAt?: string; trackingNumber?: string; courierName?: string; cancelReason?: string;
  originalDeliveryDate?: string; deliveryDateReason?: string; deliveryDateChangedAt?: string;
  canReview?: boolean; reviews?: OrderReview[];
  items: { id: number; productId: number; variantId?: number; productName: string; variantName?: string; imageUrl?: string; slug?: string; quantity: number; unitMrp: number; unitPrice: number; lineTotal: number }[];
  history: { status: OrderStatus; note?: string; createdAt: string }[];
  canCancel: boolean; canReturn: boolean; hasInvoice: boolean; invoiceNumber?: string;
  paymentProvider?: string; payment?: PaymentInstructions;
}

export interface User { id: number; fullName: string; email: string; phone?: string; role: string; }
export interface AuthResponse { token: string; expiresAt: string; user: User; }
