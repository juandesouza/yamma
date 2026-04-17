# Yamma – Folder tree

```
yamma/
├── design-system/
│   ├── src/
│   │   ├── tokens/
│   │   │   ├── colors.ts
│   │   │   ├── typography.ts
│   │   │   ├── spacing.ts
│   │   │   ├── motion.ts
│   │   │   └── index.ts
│   │   ├── theme.ts
│   │   ├── components/
│   │   │   ├── Button.tsx
│   │   │   ├── RestaurantCard.tsx
│   │   │   ├── MenuItemCard.tsx
│   │   │   ├── CartDrawer.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── ThemeProvider.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── GAMIFICATION.md
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── config.module.ts
│   │   │   ├── config.schema.ts
│   │   │   └── config.service.ts
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   └── index.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.types.ts
│   │   │   ├── guards/
│   │   │   │   ├── session.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   └── decorators/
│   │   │       ├── current-user.decorator.ts
│   │   │       └── roles.decorator.ts
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.controller.ts
│   │   ├── restaurants/
│   │   │   ├── restaurants.module.ts
│   │   │   ├── restaurants.service.ts
│   │   │   └── restaurants.controller.ts
│   │   ├── orders/
│   │   │   ├── orders.module.ts
│   │   │   ├── orders.service.ts
│   │   │   └── orders.controller.ts
│   │   ├── reviews/
│   │   │   ├── reviews.module.ts
│   │   │   ├── reviews.service.ts
│   │   │   └── reviews.controller.ts
│   │   ├── payments/
│   │   │   ├── payments.module.ts
│   │   │   ├── payments.service.ts
│   │   │   ├── payments.controller.ts
│   │   │   ├── payment-provider.interface.ts
│   │   │   └── providers/
│   │   │       ├── lemon-squeeze.provider.ts
│   │   │       └── coinbase-commerce.provider.ts
│   │   ├── mapbox/
│   │   │   ├── mapbox.module.ts
│   │   │   ├── mapbox.service.ts
│   │   │   └── mapbox.controller.ts
│   │   ├── delivery/
│   │   │   ├── delivery.module.ts
│   │   │   ├── delivery.service.ts
│   │   │   ├── delivery.controller.ts
│   │   │   └── delivery.types.ts
│   │   ├── events/
│   │   │   ├── events.module.ts
│   │   │   └── events.gateway.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── .env.example
├── web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── globals.css
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── restaurant/
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── cart/
│   │   │   │           └── page.tsx
│   │   │   ├── checkout/
│   │   │   │   └── page.tsx
│   │   │   ├── order/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   └── api/
│   │   │       ├── auth/
│   │   │       │   ├── login/
│   │   │       │   │   └── route.ts
│   │   │       │   └── register/
│   │   │       │       └── route.ts
│   │   │       └── orders/
│   │   │           └── route.ts
│   │   └── ...
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   └── .env.example
├── mobile/
│   ├── src/
│   │   └── screens/
│   │       ├── HomeScreen.tsx
│   │       ├── RestaurantScreen.tsx
│   │       ├── CartScreen.tsx
│   │       ├── OrderTrackingScreen.tsx
│   │       └── LoginScreen.tsx
│   ├── App.tsx
│   ├── index.js
│   ├── app.json
│   ├── babel.config.js
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── SETUP.md
│   ├── architecture.md
│   └── FOLDER-TREE.md
├── package.json
├── pnpm-workspace.yaml
└── README.md
```
