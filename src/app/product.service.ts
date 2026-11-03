import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { NewProduct, Product } from './product';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly productsUrl = '/products';

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.productsUrl);
  }

  create(product: NewProduct): Observable<Product> {
    return this.http.post<Product>(this.productsUrl, product);
  }
}
