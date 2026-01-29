-- Seed data for Malta property listings
-- This provides realistic sample listings from major Malta agencies

-- Use a system/scraper poster ID
DO $$
DECLARE
  system_poster_id UUID := '33333333-3333-3333-3333-333333333333';
BEGIN

INSERT INTO public.listings (
  poster_id, title, description, type, price_amount, price_currency, 
  bedrooms, bathrooms, size_sqm, address_text, status,
  source, source_url, external_link, image_url
)
SELECT * FROM (VALUES
  -- Sliema Apartments
  (system_poster_id, 'Modern 2 Bedroom Apartment in Sliema', 
   'Bright and spacious apartment with sea views. Open plan living, modern kitchen, balcony.',
   'apartment'::property_type, 1800::numeric, 'EUR', 2, 2, 95::numeric, 'Tower Road, Sliema, Malta', 'published'::listing_status,
   'RE/MAX Malta', 'https://www.remax-malta.com', 
   'https://remax-malta.com/property/sliema-2bed-tower-rd-001',
   'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'),
  (system_poster_id, 'Luxurious 3 Bedroom Penthouse Sliema', 
   'Top floor penthouse with 360 degree views, private roof terrace, high-end finishes.',
   'apartment'::property_type, 4500::numeric, 'EUR', 3, 2, 180::numeric, 'The Strand, Sliema, Malta', 'published'::listing_status,
   'Frank Salt', 'https://franksalt.com.mt', 
   'https://franksalt.com.mt/property/sliema-penthouse-strand-002',
   'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'),
  (system_poster_id, 'Cozy 1 Bedroom Flat Sliema', 
   'Perfect for professionals. Close to ferries and seafront. Fully furnished.',
   'apartment'::property_type, 950::numeric, 'EUR', 1, 1, 55::numeric, 'Bisazza Street, Sliema, Malta', 'published'::listing_status,
   'QuickLets', 'https://quicklets.com.mt', 
   'https://quicklets.com.mt/property/sliema-1bed-bisazza-003',
   'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'),
   
  -- St Julians
  (system_poster_id, '3 Bedroom Apartment St Julians', 
   'Modern apartment in prime location, walking distance to Spinola Bay. Sea glimpses.',
   'apartment'::property_type, 2200::numeric, 'EUR', 3, 2, 120::numeric, 'Paceville, St Julians, Malta', 'published'::listing_status,
   'Dhalia', 'https://dhalia.com', 
   'https://dhalia.com/property/st-julians-3bed-paceville-004',
   'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800'),
  (system_poster_id, 'Studio Apartment St Julians', 
   'Compact but stylish studio near nightlife and restaurants. Bills included.',
   'apartment'::property_type, 750::numeric, 'EUR', 0, 1, 35::numeric, 'Bay Street, St Julians, Malta', 'published'::listing_status,
   'RE/MAX Malta', 'https://www.remax-malta.com', 
   'https://remax-malta.com/property/st-julians-studio-bay-005',
   'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'),
   
  -- Valletta
  (system_poster_id, 'Character 2 Bedroom in Valletta', 
   'Beautifully restored townhouse apartment. Maltese balcony, original features.',
   'apartment'::property_type, 1650::numeric, 'EUR', 2, 1, 85::numeric, 'Merchants Street, Valletta, Malta', 'published'::listing_status,
   'Perry', 'https://www.perry.com.mt', 
   'https://perry.com.mt/property/valletta-2bed-merchants-006',
   'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800'),
   
  -- Gzira
  (system_poster_id, 'Seafront 2 Bedroom Gzira', 
   'Direct sea views from every room. Short walk to University. Modern block.',
   'apartment'::property_type, 1400::numeric, 'EUR', 2, 1, 80::numeric, 'Gzira Promenade, Gzira, Malta', 'published'::listing_status,
   'Alliance', 'https://www.alliance.mt', 
   'https://alliance.mt/property/gzira-2bed-promenade-007',
   'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'),
   
  -- Msida
  (system_poster_id, '3 Bedroom Near University', 
   'Ideal for students or family. Close to UOM, Mater Dei. Parking included.',
   'apartment'::property_type, 1200::numeric, 'EUR', 3, 2, 110::numeric, 'Triq Marina, Msida, Malta', 'published'::listing_status,
   'Simon Mamo', 'https://simonmamo.com', 
   'https://simonmamo.com/property/msida-3bed-marina-008',
   'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800'),
   
  -- Gozo
  (system_poster_id, '4 Bedroom Farmhouse with Pool Gozo', 
   'Traditional converted farmhouse. Private pool, countryside views, peaceful location.',
   'house'::property_type, 2500::numeric, 'EUR', 4, 3, 250::numeric, 'Xewkija, Gozo, Malta', 'published'::listing_status,
   'Gozo Prime', 'https://gozoprime.com', 
   'https://gozoprime.com/property/gozo-farmhouse-xewkija-009',
   'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'),
   
  -- Mellieha
  (system_poster_id, '4 Bedroom Villa Sea Views Mellieha', 
   'Stunning villa overlooking Mellieha Bay. Pool, garden, garage. Fully detached.',
   'house'::property_type, 3500::numeric, 'EUR', 4, 3, 300::numeric, 'Mellieha Heights, Mellieha, Malta', 'published'::listing_status,
   'Belair Property', 'https://belair.com.mt', 
   'https://belair.com.mt/property/mellieha-villa-heights-010',
   'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800'),
   
  -- Additional listings
  (system_poster_id, 'Newly Built 2 Bedroom Sliema', 
   'Brand new development with lift. Air-con throughout. Communal pool access.',
   'apartment'::property_type, 2000::numeric, 'EUR', 2, 2, 100::numeric, 'High Street, Sliema, Malta', 'published'::listing_status,
   'Zanzi Homes', 'https://zanzihomes.com', 
   'https://zanzihomes.com/property/sliema-2bed-highst-011',
   'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800'),
  (system_poster_id, '3 Bedroom Maisonette with Yard Mosta', 
   'Ground floor maisonette with private yard. Good for families or pet owners.',
   'house'::property_type, 1100::numeric, 'EUR', 3, 2, 130::numeric, 'Triq il-Kbira, Mosta, Malta', 'published'::listing_status,
   'Ben Estates', 'https://benestates.com', 
   'https://benestates.com/property/mosta-maisonette-kbira-012',
   'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800'),
  (system_poster_id, '1 Bedroom Apartment Floriana', 
   'Historic area near Valletta. Furnished apartment with character.',
   'apartment'::property_type, 900::numeric, 'EUR', 1, 1, 50::numeric, 'St Anne Street, Floriana, Malta', 'published'::listing_status,
   'Century 21 Malta', 'https://www.century21.mt', 
   'https://century21.mt/property/floriana-1bed-stanne-013',
   'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'),
  (system_poster_id, '2 Bedroom Apartment Birkirkara', 
   'Central location with good transport links. Quiet residential area.',
   'apartment'::property_type, 1000::numeric, 'EUR', 2, 1, 75::numeric, 'Psaila Street, Birkirkara, Malta', 'published'::listing_status,
   'Excel Homes', 'https://excel.com.mt', 
   'https://excel.com.mt/property/bkara-2bed-psaila-014',
   'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800'),
  (system_poster_id, '3 Bedroom Apartment Swieqi', 
   'Family-friendly area near schools. Large terrace with sea views.',
   'apartment'::property_type, 1600::numeric, 'EUR', 3, 2, 125::numeric, 'Madliena Road, Swieqi, Malta', 'published'::listing_status,
   'Northern Properties', 'https://www.np.com.mt', 
   'https://np.com.mt/property/swieqi-3bed-madliena-015',
   'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800'),
  (system_poster_id, 'Converted Warehouse Loft Ta Xbiex', 
   'Unique industrial-style loft. High ceilings, exposed brick, open plan.',
   'apartment'::property_type, 2800::numeric, 'EUR', 2, 2, 150::numeric, 'Ta Xbiex Seafront, Malta', 'published'::listing_status,
   'Malta Sothebys', 'https://maltasothebysrealty.com', 
   'https://maltasothebysrealty.com/property/taxbiex-loft-016',
   'https://images.unsplash.com/photo-1600573472591-ee6c8e695481?w=800'),
  (system_poster_id, 'Seafront 1 Bedroom Marsascala', 
   'Direct sea views. Perfect for beach lovers. Furnished and ready.',
   'apartment'::property_type, 850::numeric, 'EUR', 1, 1, 55::numeric, 'Marsascala Bay, Malta', 'published'::listing_status,
   'QuickLets', 'https://quicklets.com.mt', 
   'https://quicklets.com.mt/property/marsascala-1bed-bay-017',
   'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800'),
  (system_poster_id, '2 Bedroom Apartment Attard', 
   'Leafy residential area. Close to San Anton Gardens. Parking space.',
   'apartment'::property_type, 1350::numeric, 'EUR', 2, 1, 90::numeric, 'Triq San Anton, Attard, Malta', 'published'::listing_status,
   'Dhalia', 'https://dhalia.com', 
   'https://dhalia.com/property/attard-2bed-sananton-018',
   'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800'),
  (system_poster_id, 'Luxury 4 Bedroom Villa Madliena', 
   'Executive villa with infinity pool. Panoramic views. Smart home features.',
   'house'::property_type, 6000::numeric, 'EUR', 4, 4, 350::numeric, 'Madliena Heights, Malta', 'published'::listing_status,
   'Engel Volkers Malta', 'https://ev-malta.com', 
   'https://ev-malta.com/property/madliena-villa-019',
   'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'),
  (system_poster_id, 'Commercial Office Space Naxxar', 
   'Modern office in business center. Meeting rooms available. Parking.',
   'commercial'::property_type, 1500::numeric, 'EUR', 0, 1, 120::numeric, 'Naxxar Business Park, Malta', 'published'::listing_status,
   'QLC Commercial', 'https://qlc.com.mt', 
   'https://qlc.com.mt/property/naxxar-office-020',
   'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800')
) AS v(poster_id, title, description, type, price_amount, price_currency, bedrooms, bathrooms, size_sqm, address_text, status, source, source_url, external_link, image_url)
WHERE NOT EXISTS (SELECT 1 FROM public.listings WHERE external_link = v.external_link);

END $$;
