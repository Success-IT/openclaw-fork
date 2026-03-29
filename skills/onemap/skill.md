---
name: onemap
description: Singapore address lookup and geocoding via OneMap.gov.sg API. Use for postal code lookups, address searches, and coordinate retrieval in Singapore.
homepage: https://www.onemap.gov.sg/apidocs/
metadata: { "openclaw": { "emoji": "🇸🇬", "requires": { "bins": ["curl"] } } }
---

# OneMap Singapore

Singapore's authoritative mapping service. No API key needed for basic searches.

## Address/Postal Code Search

```bash
curl -s "https://www.onemap.gov.sg/api/common/elastic/search?searchVal=QUERY&returnGeom=Y&getAddrDetails=Y&pageNum=1"
```

Replace `QUERY` with:

- Postal code: `018956`
- Building name: `marina+bay+sands`
- Street name: `orchard+road`
- Address: `1+raffles+place`

URL-encode spaces as `+`.

## Response Format

```json
{
  "found": 5,
  "totalNumPages": 1,
  "pageNum": 1,
  "results": [
    {
      "SEARCHVAL": "MARINA BAY SANDS",
      "BLK_NO": "10",
      "ROAD_NAME": "BAYFRONT AVENUE",
      "BUILDING": "MARINA BAY SANDS",
      "ADDRESS": "10 BAYFRONT AVENUE MARINA BAY SANDS SINGAPORE 018956",
      "POSTAL": "018956",
      "X": "30120.123",
      "Y": "29456.789",
      "LATITUDE": "1.2834567",
      "LONGITUDE": "103.8612345"
    }
  ]
}
```

## Common Uses

**Lookup by postal code:**

```bash
curl -s "https://www.onemap.gov.sg/api/common/elastic/search?searchVal=018956&returnGeom=Y&getAddrDetails=Y&pageNum=1" | jq '.results[0]'
```

**Find a building:**

```bash
curl -s "https://www.onemap.gov.sg/api/common/elastic/search?searchVal=ion+orchard&returnGeom=Y&getAddrDetails=Y&pageNum=1" | jq '.results[:3]'
```

**Get coordinates for an address:**

```bash
curl -s "https://www.onemap.gov.sg/api/common/elastic/search?searchVal=1+raffles+place&returnGeom=Y&getAddrDetails=Y&pageNum=1" | jq '.results[0] | {ADDRESS, LATITUDE, LONGITUDE}'
```

## Reverse Geocode (coordinates to address)

```bash
curl -s "https://www.onemap.gov.sg/api/public/revgeocodexy?location=103.8612,1.2834&buffer=50&addressType=All"
```

Parameters:

- `location`: longitude,latitude (note: lng first)
- `buffer`: search radius in meters
- `addressType`: All, HDB, or Landed

## Route Planning

```bash
curl -s "https://www.onemap.gov.sg/api/public/routingsvc/route?start=1.2834,103.8612&end=1.3000,103.8500&routeType=drive"
```

Route types: `drive`, `walk`, `cycle`, `pt` (public transport)

## Notes

- Singapore addresses only
- No API key required for search endpoints
- Some endpoints (themes, private APIs) require registration
- Rate limits apply but are generous for normal use
