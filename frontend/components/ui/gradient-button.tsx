import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function GradientButton() {
  const router = useRouter();
  
  return (
    <Button 
      onClick={() => router.push('/generator')}
      className='bg-[#F4CE14] hover:bg-[#F4CE14]/90 text-black font-bold py-6 px-10 rounded-full transition-all duration-500 shadow-[0_0_20px_rgba(244,206,20,0.3)]'
    >
      Get Started
    </Button>
  )
}
