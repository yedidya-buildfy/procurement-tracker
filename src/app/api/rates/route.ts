import { NextResponse } from 'next/server';

const DEFAULT_RATES = { USD: 3.76, CNY: 0.52, live: false };

export async function GET() {
  try {
    const response = await fetch('https://www.boi.org.il/PublicApi/GetExchangeRates', {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      return NextResponse.json(DEFAULT_RATES);
    }

    const data = await response.json();
    const rates = { USD: 3.76, CNY: 0.52, live: false };

    data.exchangeRates?.forEach((r: { key: string; currentExchangeRate: number }) => {
      if (r.key === 'USD') rates.USD = r.currentExchangeRate;
      if (r.key === 'CNY') rates.CNY = r.currentExchangeRate;
    });

    rates.live = true;
    return NextResponse.json(rates);
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json(DEFAULT_RATES);
  }
}
