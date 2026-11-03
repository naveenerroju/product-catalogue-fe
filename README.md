# Product catalogue

A small Angular frontend connected to the Spring Boot `product-service`. You can use it to:

- View all products returned by the backend.
- Add a product by entering its name and price.

The Angular app is the part you see in the browser. The Spring Boot app handles the API and saves/loads product data. During local development, Angular forwards API requests to Spring Boot.

## Contents

- [What happens when the app starts?](#what-happens-when-the-app-starts)
- [How the page and components fit together](#how-the-page-and-components-fit-together)
- [How loading products works](#how-loading-products-works)
- [How adding a product works](#how-adding-a-product-works)
- [How Angular talks to Spring Boot](#how-angular-talks-to-spring-boot)
- [Project files](#project-files)
- [Run both applications](#run-both-applications)
- [Useful Angular ideas in this project](#useful-angular-ideas-in-this-project)
- [Troubleshooting](#troubleshooting)
- [Next places to explore](#next-places-to-explore)

## What happens when the app starts?

The starting point is `src/index.html`. It is the ordinary HTML document the browser loads. It contains an `<app-root>` element; Angular uses that element as the place to put the application.

Here is the startup chain:

```text
Browser opens src/index.html
        |
        | finds <app-root>
        v
src/main.ts calls bootstrapApplication(App, appConfig)
        |
        | starts the root App component and registers app-wide providers
        v
src/app/app.ts connects the component class to its template and styles
        |
        v
src/app/app.html draws the catalogue page
```

In more detail:

1. The browser loads `src/index.html`.
2. The Angular build adds the compiled JavaScript and CSS to the page.
3. `src/main.ts` calls Angular's `bootstrapApplication` function. “Bootstrap” here means “start the application.”
4. `App` is passed as the root component. It is the top-level Angular component for this app.
5. `appConfig` registers features the app needs, including Angular's HTTP client.
6. Angular creates the `App` component, connects it to `src/app/app.html`, and puts the rendered page inside `<app-root>`.
7. When the component initializes, it asks the product service to load the products.

This project uses Angular's **standalone** style. The root component imports the Angular features it uses directly in its `@Component` metadata. It does not need an `AppModule` or an `NgModule`.

## How the page and components fit together

An Angular **component** is a piece of the user interface. A component usually has:

- A TypeScript class for data and behavior.
- An HTML template for the visible page.
- Optional CSS for how that page looks.

The root `App` component connects those pieces with this decorator in `src/app/app.ts`:

```ts
@Component({
  imports: [CurrencyPipe, FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
```

- `selector: 'app-root'` matches the `<app-root>` element in `src/index.html`.
- `templateUrl` tells Angular which HTML file belongs to this component.
- `styleUrl` tells Angular which component stylesheet to use.
- `imports` makes Angular features available in this template. `FormsModule` enables `[(ngModel)]` and `CurrencyPipe` formats product prices as currency.

There are **not separate child components** for the form or product cards yet. The page is intentionally small: `app.html` draws the header, form, loading/empty messages, and product cards as parts of the one root component.

The project has a router configuration file, `src/app/app.routes.ts`, but this page does not currently use routing. The `<router-outlet>` starter placeholder was replaced by the catalogue page, and there are no routes to navigate between.

## How loading products works

When Angular creates `App`, it calls the `ngOnInit` lifecycle method. The method calls `loadProducts()`.

```text
App is created
    |
    v
ngOnInit() calls loadProducts()
    |
    v
ProductService.getAll()
    |
    v
GET /products
    |
    v
Spring ProductController -> ProductService -> ProductRepository
    |
    v
JSON product list comes back
    |
    v
products signal is updated; Angular redraws the list
```

In `src/app/app.ts`, `loading` starts as `true`. While the request is in progress, the template shows “Loading products...”. If it succeeds, the returned array is put into `products`, then `loading` becomes `false`. The HTML then shows either an empty-state message or the product cards.

The `products` value is an Angular **signal**:

```ts
readonly products = signal<Product[]>([]);
```

A signal is a value Angular can observe. The template reads it with `products()`. When code changes it with `products.set(...)` or `products.update(...)`, Angular knows the displayed page may need to update.

The HTML uses Angular's built-in control-flow syntax:

- `@if` chooses what to show depending on whether the app is loading, has an error, or has products.
- `@for` repeats the product-card markup once for each product.
- `track product.id` gives Angular a stable identifier for each repeated product.

## How adding a product works

The form in `src/app/app.html` collects a product name and price. `FormsModule` enables two-way binding:

```html
<input name="name" [(ngModel)]="name" />
<input name="price" [(ngModel)]="price" />
```

`[(ngModel)]` keeps an input and a component property in sync: typing updates `name` or `price` in `app.ts`, and changing those properties updates the input. The square and round brackets in this syntax are Angular's shorthand for sending a value to the input and listening for changes from it.

When the user submits the form, `(ngSubmit)="addProduct()"` calls `App.addProduct()`. That method:

1. Trims the name and checks that it is not blank.
2. Checks that the price is a finite, non-negative number. The HTML form also marks both inputs as required, restricts the price to zero or above, and disables the submit button when the form is invalid or a request is already in progress.
3. Builds the request object with just `name` and `price`.
4. Calls `ProductService.create(...)`, which sends `POST /products`.
5. On success, adds the product returned by the backend to the `products` signal, clears the form, and shows a success message.
6. On failure, keeps the entered values and displays an error message.

The backend assigns the product ID. For that reason a new product sent to the backend has this shape:

```json
{
  "name": "Wireless headphones",
  "price": 49.99
}
```

A saved product returned from the backend also has an `id`, for example:

```json
{
  "id": 1,
  "name": "Wireless headphones",
  "price": 49.99
}
```

## How Angular talks to Spring Boot

The backend controller is mapped to `/products`, so the frontend uses these endpoints:

| Action | HTTP request | Request body | Response |
|---|---|---|---|
| Load all products | `GET /products` | None | A JSON array of products |
| Add a product | `POST /products` | `{"name":"...", "price":49.99}` | The saved product, including its ID |

The HTTP calls are kept in one place: `src/app/product.service.ts`. Its `getAll()` method sends the GET request; `create()` sends the POST request. The service uses Angular's `HttpClient`, registered in `src/app/app.config.ts` by `provideHttpClient()`.

`HttpClient` returns an **Observable** for each request. An Observable represents a value that may arrive later. The component calls `.subscribe(...)` to start the request and provide separate success (`next`) and failure (`error`) behavior. This is why the page can continue rendering while the network request is in progress.

### Why there is a proxy

The browser page runs at `http://localhost:4200`, while Spring Boot listens at `http://localhost:8080`. Those are different origins. Browsers restrict cross-origin requests unless the backend explicitly permits them.

For local development, `proxy.conf.json` tells Angular's development server:

```text
Request from browser: http://localhost:4200/products
Angular dev-server forwards to: http://localhost:8080/products
```

The service calls the relative URL `/products`, and `angular.json` enables `proxy.conf.json` for `ng serve`. This keeps the frontend code simple and avoids needing to configure browser CORS for local development.

**The proxy is only a development-server feature.** It does not automatically configure a production deployment. In production, the frontend and backend need a deployment-specific arrangement, such as serving both behind the same domain/reverse proxy or configuring the backend and frontend with the correct API URL and CORS policy.

### What the Spring Boot backend does

The frontend does not connect directly to the database. The request travels through the backend:

```text
Angular ProductService
    -> ProductController       receives GET or POST /products
    -> backend ProductService  applies the product operation
    -> ProductRepository       reads/writes through Spring Data JPA
    -> database                stores or returns product data
```

The controller's `GET` and `POST` handlers are in `ProductController.java`. The backend product model has `id`, `name`, and `price`; the repository uses JPA to load and save it. The controller returns the results as JSON, which Angular uses to update the page.

When running with the backend's `local` profile, it uses an in-memory H2 database. This is convenient for trying the project, but the data is temporary and is lost when the backend stops.

## Project files

### Angular application files

| File | What it does |
|---|---|
| `src/index.html` | Browser HTML shell; contains the `<app-root>` mount point. |
| `src/main.ts` | Angular startup file; bootstraps the root `App` component. |
| `src/app/app.ts` | Root component class; holds page state, loads products, validates and submits additions. |
| `src/app/app.html` | Root component template; contains the form, messages, and product list. |
| `src/app/app.css` | Styles used by the root component/page. |
| `src/app/app.config.ts` | Application-wide providers; currently registers HTTP support and browser error listeners. |
| `src/app/product.ts` | TypeScript shapes for a saved `Product` and a new product request. |
| `src/app/product.service.ts` | HTTP methods for the backend's GET and POST endpoints. |
| `src/app/app.routes.ts` | Route definitions; currently empty and not needed for this single-page screen. |
| `src/app/app.spec.ts` | Unit tests for creating and rendering the root component. The product service is replaced with a small fake in these tests. |
| `src/styles.css` | Global page styles, such as the body font, background, and box sizing. |
| `proxy.conf.json` | Forwards `/products` requests from the Angular development server to the backend on port 8080. |
| `public/` | Static files copied into the built app, such as the favicon. |

### Project configuration files

| File | What it does |
|---|---|
| `package.json` | Lists JavaScript dependencies and common commands such as `npm start`, `npm run build`, and `npm test`. |
| `package-lock.json` | Records the exact dependency versions installed by npm. Keep it with the project when changing dependencies. |
| `angular.json` | Angular CLI project configuration, including build styles and the development-server proxy. |
| `tsconfig.json` | Shared TypeScript compiler settings. |
| `tsconfig.app.json` | TypeScript settings and source-file selection for the application build. |
| `tsconfig.spec.json` | TypeScript settings for test files. |
| `node_modules/` | Installed dependencies; generated by npm and not application source code. |
| `dist/` | Generated build output; created by `npm run build`. |

### Related Spring Boot files

These are in the sibling `product-service` project, not in this Angular repository:

| File | What it does |
|---|---|
| `src/main/java/com/gihub/products/controller/ProductController.java` | Defines `GET /products` and `POST /products`. |
| `src/main/java/com/gihub/products/service/ProductService.java` | Backend layer that delegates product operations to the repository. |
| `src/main/java/com/gihub/products/repository/ProductRepository.java` | Spring Data JPA repository for saving and retrieving products. |
| `src/main/java/com/gihub/products/dto/Product.java` | JPA entity/product data with `id`, `name`, and `price`. |
| `src/main/resources/application-local.yml` | Local profile database configuration (H2). |

## Run both applications

You need Node.js/npm for Angular and Java for Spring Boot. The Spring project includes a Maven wrapper (`mvnw.cmd`), so a separate Maven installation is usually not needed.

### 1. Start Spring Boot

Open a terminal in the Angular project directory and run:

```powershell
cd ..\product-service
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

Wait for Spring Boot to finish starting. It should report that Tomcat is listening on port `8080`. Leave this terminal running.

### 2. Start Angular

Open a second terminal in the Angular project directory:

```powershell
npm install
npm start
```

`npm install` is needed the first time (or after dependencies change). `npm start` starts the Angular development server. Open [http://localhost:4200](http://localhost:4200) in your browser and leave this terminal running too.

### 3. Try the app

The page first requests the existing product list. Enter a product name and a non-negative price, then choose **Add product**. On success, the new product appears in the list without a page reload.

To check the backend directly, you can use these URLs or commands:

```powershell
Invoke-RestMethod -Uri http://localhost:8080/products
```

```powershell
$body = @{ name = "Desk lamp"; price = 24.50 } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:8080/products -Method Post -ContentType "application/json" -Body $body
```

### Other Angular commands

Run these from the Angular project directory:

```powershell
npm run build
npm test -- --watch=false
```

- `npm run build` checks and compiles the application into `dist/`.
- `npm test -- --watch=false` runs the unit tests once and exits.
- `npm start` runs a development server that rebuilds as you edit files.

The component tests use a fake `ProductService`; they check the Angular component and template without requiring Spring Boot to be running. Use the manual run instructions above to exercise the real frontend/backend connection.

## Useful Angular ideas in this project

- **Component:** A UI unit made from a TypeScript class, an HTML template, and optionally CSS. `App` is currently the only component.
- **Template:** HTML with Angular features added, such as `{{ value }}`, `(ngSubmit)`, `[(ngModel)]`, `@if`, and `@for`.
- **Interpolation:** `{{ product.name }}` inserts a value from the component into the page.
- **Event binding:** `(ngSubmit)="addProduct()"` calls component code when an event occurs.
- **Two-way binding:** `[(ngModel)]="name"` keeps a form input synchronized with a component property.
- **Signal:** A reactive value, such as `products`, that Angular tracks and redraws when changed.
- **Dependency injection:** Angular provides a service to a component that asks for it. `ProductService` is registered with `providedIn: 'root'`, so Angular creates it when needed.
- **Observable:** The asynchronous result type returned by `HttpClient`. The component subscribes to receive the response or handle an error.
- **TypeScript interface:** `Product` describes the expected product data shape at compile time. It does not validate JSON at runtime.
- **Pipe:** `CurrencyPipe` transforms a value for display; here it formats the product's price.

## Troubleshooting

### The page says it could not load products

- Confirm Spring Boot is still running.
- Check that the backend started on port `8080`.
- Open `http://localhost:8080/products` directly. An empty JSON array (`[]`) is a valid response if there are no saved products yet.
- Confirm Angular was started with `npm start` so the development proxy is active.

### The form says it could not add the product

- Check the Spring Boot terminal for an error.
- Confirm the entered name is not blank and the price is a valid number greater than or equal to zero.
- Check `http://localhost:8080/products` again to see whether the backend is responding.

### Port 8080 or 4200 is already in use

Another program may already be using the port. Stop the other development server, or deliberately configure a different port and update the proxy target to match. The Angular page currently expects the backend at port `8080`.

### Products disappear after a backend restart

That is expected when using the local Spring profile: its H2 database is in memory. Use a persistent database profile if product data needs to survive backend restarts.

### I changed the proxy but Angular still uses the old setting

Stop `npm start` with Ctrl+C and start it again. The development server reads `proxy.conf.json` when it starts.

## Next places to explore

For a complete beginner walkthrough, follow the code in this order:

1. Read `src/index.html` and find `<app-root>`.
2. Read `src/main.ts` to see how Angular starts.
3. Read `src/app/app.ts` and `src/app/app.html` together: the class supplies values and methods used by the template.
4. Follow `loadProducts()` into `src/app/product.service.ts`.
5. Follow the request to `proxy.conf.json`, then read the Spring Boot `ProductController`.
6. Trace the backend from controller to service, repository, and database.
7. Follow `addProduct()` in the same way, noticing that the POST response is added to the products signal.
