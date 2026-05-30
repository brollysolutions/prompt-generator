import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function GradientButton() {
  const router = useRouter();
  
  return (
    <Button 
      onClick={() => router.push('/generator')}
      className='from-[#D4AF37] via-[#AA8A27] to-[#D4AF37] bg-transparent bg-gradient-to-r [background-size:200%_auto] hover:bg-transparent hover:bg-[99%_center] text-black font-bold py-6 px-10 rounded-full transition-all duration-500 shadow-[0_0_20px_rgba(212,175,55,0.3)]'
    >
      Get Started
    </Button>
  )
}
