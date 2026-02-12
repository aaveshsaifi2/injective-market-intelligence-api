# Injective Market Intelligence API

> A developer-focused REST API for advanced market intelligence on the Injective ecosystem.

The **Injective Market Intelligence API** provides structured, developer-friendly endpoints for retrieving market metadata, liquidity insights, order book analytics, and real-time trading intelligence from Injective markets.

Built for backend developers, trading bots, analytics dashboards, and Web3 applications.

---

## 🚀 Features

- 📊 Market metadata (spot & derivatives)
- 💧 Liquidity analysis
- 📈 Order book depth metrics
- 🔄 Real-time market insights
- 🧠 Structured JSON responses
- ⚡ Fast and lightweight TypeScript backend
- 🧩 Modular route architecture

---

## 🏗 Tech Stack

- Node.js
- TypeScript
- Express.js
- Axios
- Injective Public APIs

---

## 📁 Project Structure

```
imi-api/
├── src/
│   ├── index.ts                    # App entry + server setup
│   ├── config/
│   │   └── markets.ts              # Market IDs + metadata
│   ├── routes/
│   │   ├── health.routes.ts
│   │   ├── markets.routes.ts
│   │   ├── liquidity.routes.ts
│   │   ├── orderbook.routes.ts
│   │   └── analytics.routes.ts
│   ├── services/
│   │   ├── injective.service.ts    # Injective API calls
│   │   ├── liquidity.service.ts
│   │   └── analytics.service.ts
│   └── types/
│       └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## ⚙️ Installation

Clone the repository:

```bash
git clone https://github.com/aaveshsaifi2/injective-market-intelligence-api.git
cd injective-market-intelligence-api
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm start
```

---

## 🌐 API Endpoints

### Health Check

```
GET /health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-12T10:00:00Z"
}
```

---

### Get All Markets

```
GET /markets
```

Returns configured Injective markets with metadata.

---

### Get Order Book

```
GET /orderbook/:marketId
```

Example:

```
GET /orderbook/INJ-USDT
```

Returns:

```json
{
  "marketId": "INJ-USDT",
  "bestBid": "25.34",
  "bestAsk": "25.36",
  "spread": "0.02",
  "bidsDepth": "125430.23",
  "asksDepth": "118320.11"
}
```

---

### Liquidity Insights

```
GET /liquidity/:marketId
```

Provides:

- Total bid liquidity
- Total ask liquidity
- Spread %
- Liquidity imbalance ratio

---

### Advanced Analytics

```
GET /analytics/:marketId
```

Includes:

- Volatility metrics
- Price movement summary
- Depth concentration
- Market pressure indicator

---

## 🧠 Example Usage

Using curl:

```bash
curl http://localhost:3000/orderbook/INJ-USDT
```

Using fetch:

```ts
const response = await fetch("http://localhost:3000/markets");
const data = await response.json();
console.log(data);
```

---

## 🔐 Environment Variables

Create a `.env` file:

```
PORT=3000
INJECTIVE_BASE_URL=https://api.injective.network
```

---

## 🎯 Use Cases

- Trading bots
- Market monitoring dashboards
- Liquidity scanners
- Arbitrage detection tools
- Quant research backends
- Developer tooling for Injective ecosystem

---

## 🧪 Testing

You can test endpoints using:

- Postman
- Thunder Client
- curl
- Custom frontend integration

---

## 📌 Roadmap

- [ ] WebSocket streaming
- [ ] Historical OHLC endpoint
- [ ] Market sentiment scoring
- [ ] API key rate limiting
- [ ] Docker support
- [ ] Swagger documentation

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

## 📄 License

MIT License

---

## 👨‍💻 Author

Aavesh Saifi  
GitHub: https://github.com/aaveshsaifi2

---

If you'd like, I can also generate:

- ✅ A professional hackathon-optimized README (for judges)
- ✅ Swagger/OpenAPI spec
- ✅ Production deployment guide (Railway/Render/Vercel)
- ✅ Dockerfile
- ✅ Postman collection
