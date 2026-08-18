import { redirect } from "next/navigation";

/**
 * FN-18: `/financeiro` é o `href` do grupo no menu — o usuário chega aqui com um
 * clique e caía no 404 cru do Next. Redireciona para a primeira tela do grupo,
 * que é o que ele queria abrir.
 */
export default function FinanceiroIndexPage() {
  redirect("/financeiro/lancamentos");
}
