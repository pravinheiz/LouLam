# Property Details Page Design Specification
## Geo-Intelligent Real Estate Marketplace MVP

This document outlines the architectural specifications, component hierarchies, and UX patterns for the Property Details Page in the marketplace.

---

### 1. Page Architecture

The property details page is structured as a **hybrid Next.js App Router page** to optimize page load speeds, SEO indexability, and client side interactive capability.

```mermaid
graph TD
    A[Request: /listings/:id] --> B[Server Page: src/app/listings/[id]/page.tsx]
    B --> C[Parallel Fetching: Promise.all]
    C --> D[ListingsService.getListingById]
    C --> E[PriceEstimationService.estimatePrice]
    C --> F[SpatialService.searchNearby]
    D --> G[Generate metadata & JSON-LD]
    E --> H[Pre-rendered Valuation Card]
    F --> I[Pre-rendered Suggestions Grid]
    B --> J[Client Component Hydration]
    J --> K[Image Gallery Carousel]
    J --> L[Dynamic Leaflet Map: ssr disabled]
```

---

### 2. Component Structure

The page coordinates several functional components:

*   **`ListingDetailPage` (Server Component)**: The page entry-point container. Fetches all data on the server, generates SEO headers, and structures the responsive Grid layout.
*   **`ImageGallery` (Client Component)**: A swipe-ready, responsive hero image layout. Includes a thumbnail strip and fullscreen lightbox/slider.
*   **`ValuationDisplay` (Server Component)**: Renders the PostGIS-backed price valuation engine. Shows estimated value, low/high range, local price per sqft, comparable count, and confidence rating indicator.
*   **`SellerCard` (Server Component)**: Renders seller avatar, email contact details, and a verified legal name badge (if `SellerVerification.status === 'APPROVED'`).
*   **`PropertyDetailsMap` (Client Component)**: An interactive Map Container showing the property's point location marker, boundary polygon, and neighboring listing pins within a 5km radius. Loaded dynamically to avoid SSR errors.
*   **`NearbySuggestions` (Server Component)**: Lists up to 4 nearby properties in a sleek, responsive card grid showing distance labels (e.g. `1.2 km away`).

---

### 3. Data Fetching Strategy

Data is fetched directly on the server inside the page component. This completely eliminates client-side network round-trips for core content, allowing search engine bots to instantly index full property details.

*   **Parallel Fetching**: We utilize `Promise.all` to fetch the primary listing, nearby properties, and price estimation in parallel, reducing overall response latency:
    ```typescript
    const listing = await ListingsService.getListingById(id);
    const [nearbyListings, priceEstimate] = await Promise.all([
      SpatialService.searchNearby(listing.latitude, listing.longitude, 5000), // 5km radius
      listing.areaSqft 
        ? PriceEstimationService.estimatePrice(listing.latitude, listing.longitude, listing.propertyType, listing.areaSqft).catch(() => null)
        : Promise.resolve(null)
    ]);
    ```
*   **API Security**: Since fetches run server-side in Prisma/PostgreSQL, database credentials and internal API parameters remain securely hidden from client-side inspectors.

---

### 4. Map Rendering Workflow

Leaflet maps require browser APIs (`window`, `document`) which are absent during Next.js server pre-rendering. To prevent runtime crash events:

1.  **Dynamic Import**: The Leaflet map component is imported dynamically with `ssr: false` using `next/dynamic`.
2.  **Boundary Transformation**: The GeoJSON polygon geometry `[lng, lat]` returned by PostGIS is converted to Leaflet's coordinate format `[lat, lng]` before rendering.
3.  **Visual Distinction**: The active listing is highlighted using a custom prominent marker icon and boundary outline, while neighboring property pins use smaller markers.

---

### 5. SEO Structure

Search engine crawlers require crawlable HTML. We automatically inject optimized headers and rich snippets:

*   **Dynamic Metadata Generation**:
    ```typescript
    export async function generateMetadata({ params }): Promise<Metadata> {
      const { id } = await params;
      const listing = await ListingsService.getListingById(id);
      return {
        title: `${listing.title} | ${listing.address} | Heisnam Estate`,
        description: `${listing.description.substring(0, 160)}...`,
        openGraph: {
          title: listing.title,
          description: listing.description,
          images: listing.images,
        },
      };
    }
    ```
*   **JSON-LD Structured Data**: Injects structured real estate listing metadata into the DOM for rich Google Search features:
    ```html
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    ```

---

### 6. Responsive Design Strategy

A mobile-friendly layout optimized for Capicitor/Android web views and desktop displays:

*   **Grid Framework**: A two-column responsive grid:
    *   **Mobile View**: Stacked single-column layout. The image gallery takes full width, followed by price, valuation, map, details overview, seller information, and nearby suggestions.
    *   **Desktop View (`md:grid-cols-3`)**: A `2/3` main content panel (Gallery, Overview, Nearby Suggestions) and `1/3` sticky sidebar panel (Price, Valuation, Map, Seller contact details).
*   **Touch Targets**: Buttons, gallery controls, and links feature a minimum target sizing of `44px` to comply with accessibility audits on mobile devices.

---

### 7. Performance Optimization

*   **Code Splitting**: Splitting out Leaflet JS/CSS libraries limits primary bundle weight and speeds up LCP (Largest Contentful Paint).
*   **Image Caching**: Images are loaded using optimized styling and CDN source transformations to compress file weight.
*   **Index-Backed DB Operations**: Nearby property search utilizes GIST spatial indexing (`geom`) and bounding box filters to execute queries in under 5ms.

---

### 8. Loading States

To ensure a seamless user experience while dynamic components hydrate:
*   **Map Placeholder**: A Pulse-animated loader card is shown while Leaflet components initialize.
*   **Skeleton Grids**: Skeleton shimmers with custom styling provide visually appealing layout placeholders.

---

### 9. Error Handling

*   **Valuation Fallback**: If a property does not have a boundary polygon or there are fewer than 3 local comparables in a 10km radius, the Valuation Display gracefully hides the estimation charts and shows a user-friendly info message: *"Insufficient nearby comparable listings to formulate a spatial estimate."*
*   **Missing Images Fallback**: Houses without uploaded photos fallback to a stylized placeholder SVG card.
*   **Error Boundaries**: Route handles unexpected search errors or database connection timeouts without breaking the main navigation bar.

---

### 10. Folder Organization

The details page structure is organized as follows:

```
src/
├── app/
│   └── listings/
│       └── [id]/
│           ├── page.tsx            # Main Server Page & SEO Generation
│           └── loading.tsx         # Page-level Loading Shimmer Skeleton
├── components/
│   ├── image-gallery.tsx           # Client Component: Responsive Photo Slider
│   ├── property-details-map.tsx    # Client Component: Leaflet polygon visualization
│   └── valuation-display.tsx       # Server/Client: Spatial pricing stats
```
