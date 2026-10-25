import api from './axios';
import type {
  ProductListResponse,
  ProductDetailResponse,
  CatalogCategory,
  CatalogBrand,
} from './types';

export interface ProductQueryFilters {
  category?: string;
  brand?: string;
  search?: string;
  featured?: boolean;
  newArrivals?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'updated_at' | 'published_at';
  ascending?: boolean;
}

export interface InquiryInput {
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  productId: string;
  productName: string;
  variantSku?: string;
  targetQuantity: number;
  unit: string;
  deliveryTerm?: string;
  notes?: string;
  faxNumber?: string;
}

export interface InquiryResponse {
  success: boolean;
  referenceNumber: string;
  message: string;
}

export const catalogApi = {
  // 1. Get products list with filters & pagination
  async getProducts(filters: ProductQueryFilters = {}): Promise<ProductListResponse> {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.search) params.set('q', filters.search);
    if (filters.featured) params.set('featured', 'true');
    if (filters.newArrivals) params.set('new', 'true');
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.ascending !== undefined) params.set('asc', String(filters.ascending));

    const queryString = params.toString();
    const url = `/api/catalog/products${queryString ? `?${queryString}` : ''}`;
    return api.get<ProductListResponse>(url);
  },

  // 2. Get single product detail by slug
  async getProductBySlug(slug: string): Promise<ProductDetailResponse> {
    return api.get<ProductDetailResponse>(`/api/catalog/products/${encodeURIComponent(slug)}`);
  },

  // 3. Get category list (with optional hierarchy tree)
  async getCategories(options: { tree?: boolean } = {}): Promise<CatalogCategory[]> {
    const url = `/api/catalog/categories${options.tree ? '?tree=true' : ''}`;
    return api.get<CatalogCategory[]>(url);
  },

  // 4. Get active partner brands
  async getBrands(): Promise<CatalogBrand[]> {
    return api.get<CatalogBrand[]>('/api/catalog/brands');
  },

  // 5. Get technical document download URL
  async getDocumentDownloadUrl(id: string): Promise<{ url: string }> {
    return api.get<{ url: string }>(`/api/catalog/documents/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
    });
  },

  // 6. Get public technical compliance documents repository
  async getDocuments(filters: {
    type?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{
    documents: import('./types').CatalogDocument[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.search) params.set('q', filters.search);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

    const qs = params.toString();
    return api.get(`/api/catalog/documents${qs ? `?${qs}` : ''}`);
  },

  // 7. Submit B2B Request for Quotation (RFQ)
  async submitInquiry(inquiry: InquiryInput): Promise<InquiryResponse> {
    return api.post<InquiryResponse>('/api/catalog/inquiry', inquiry);
  },
};

export default catalogApi;
