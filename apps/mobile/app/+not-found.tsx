import { Link } from 'expo-router'
import { Centered, Muted, Title } from '@/ui/primitives'

export default function NotFound() {
  return (
    <Centered>
      <Title>Tela não encontrada</Title>
      <Link href="/"><Muted>Voltar ao início</Muted></Link>
    </Centered>
  )
}
