import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NewProduct, Product } from './product';
import { ProductService } from './product.service';

@Component({
  imports: [CurrencyPipe, FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  name = '';
  price: number | null = null;

  constructor(private readonly productService: ProductService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  addProduct(): void {
    const name = this.name.trim();
    const price = this.price;

    if (!name) {
      this.error.set('Enter a product name.');
      return;
    }

    if (price === null || !Number.isFinite(price) || price < 0) {
      this.error.set('Enter a valid, non-negative price.');
      return;
    }

    const product: NewProduct = { name, price };
    this.error.set('');
    this.success.set('');
    this.submitting.set(true);

    this.productService.create(product).subscribe({
      next: (createdProduct) => {
        this.products.update((products) => [...products, createdProduct]);
        this.name = '';
        this.price = null;
        this.success.set('Product added successfully.');
        this.submitting.set(false);
      },
      error: () => {
        this.error.set('Could not add the product. Check that the product service is running.');
        this.submitting.set(false);
      },
    });
  }

  private loadProducts(): void {
    this.loading.set(true);

    this.productService.getAll().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load products. Check that the product service is running.');
        this.loading.set(false);
      },
    });
  }
}
