import {developmentBorrowing} from './session'
export function DevelopmentAccount(){
 if(!developmentBorrowing)return null
 return <section className="config-notice"><strong>Development borrowing · Local only · No money moves</strong><p>Use your email sign-in above to test the temporary payment adapter.</p></section>
}
