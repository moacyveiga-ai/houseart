import type { Metadata } from 'next'
import { PhoneSimulator } from '@/components/simulator/PhoneSimulator'

export const metadata: Metadata = { title: 'Simulador do app', description: 'O app HouseArt (as telas nativas do celular) rodando numa moldura de aparelho.', robots: { index: false } }

export default function SimulatorPage() {
  return <PhoneSimulator />
}
