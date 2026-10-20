import { Routes } from '@angular/router';
import { authGuard } from './core/store';
import { LayoutComponent } from './layout/layout';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', loadComponent: () => import('./pages/home').then(m => m.HomePage), title: 'WoodsyCart — Furniture in Bengaluru, factory-direct' },
      { path: 'shop', loadComponent: () => import('./pages/shop').then(m => m.ShopPage), title: 'Shop furniture · WoodsyCart' },
      { path: 'offers', loadComponent: () => import('./pages/offers').then(m => m.OffersPage), title: 'Festival offers · WoodsyCart' },
      { path: 'offers/:slug', loadComponent: () => import('./pages/offers').then(m => m.OfferPage), title: 'Offers · WoodsyCart' },
      { path: 'product/:slug', loadComponent: () => import('./pages/product').then(m => m.ProductPage), title: 'WoodsyCart' },
      { path: 'cart', loadComponent: () => import('./pages/cart').then(m => m.CartPage), title: 'Your cart · WoodsyCart' },
      { path: 'checkout', loadComponent: () => import('./pages/checkout').then(m => m.CheckoutPage), title: 'Checkout · WoodsyCart' },
      { path: 'wishlist', canActivate: [authGuard], loadComponent: () => import('./pages/wishlist').then(m => m.WishlistPage), title: 'Wishlist · WoodsyCart' },
      { path: 'login', loadComponent: () => import('./pages/login').then(m => m.LoginPage), title: 'Sign in · WoodsyCart' },
      { path: 'register', loadComponent: () => import('./pages/login').then(m => m.LoginPage), data: { register: true }, title: 'Create account · WoodsyCart' },
      { path: 'track', loadComponent: () => import('./pages/track').then(m => m.TrackPage), title: 'Track your order · WoodsyCart' },
      { path: 'order/:orderNumber', loadComponent: () => import('./pages/account/order').then(m => m.OrderPage), title: 'Order · WoodsyCart' },
      {
        path: 'account', canActivate: [authGuard], loadComponent: () => import('./pages/account/account').then(m => m.AccountPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'orders' },
          { path: 'orders', loadComponent: () => import('./pages/account/orders').then(m => m.OrdersPage), title: 'My orders · WoodsyCart' },
          { path: 'addresses', loadComponent: () => import('./pages/account/addresses').then(m => m.AddressesPage), title: 'Addresses · WoodsyCart' },
          { path: 'profile', loadComponent: () => import('./pages/account/profile').then(m => m.ProfilePage), title: 'Profile · WoodsyCart' }
        ]
      },
      { path: 'contact', loadComponent: () => import('./pages/contact').then(m => m.ContactPage), title: 'Contact us · WoodsyCart' },
      { path: 'about', loadComponent: () => import('./pages/info').then(m => m.InfoPage), data: { page: 'about' }, title: 'About · WoodsyCart' },
      { path: 'faq', loadComponent: () => import('./pages/info').then(m => m.InfoPage), data: { page: 'faq' }, title: 'FAQs · WoodsyCart' },
      { path: 'policies/:page', loadComponent: () => import('./pages/info').then(m => m.InfoPage), title: 'Policies · WoodsyCart' },
      { path: '**', loadComponent: () => import('./pages/info').then(m => m.InfoPage), data: { page: 'not-found' }, title: 'Page not found · WoodsyCart' }
    ]
  }
];
