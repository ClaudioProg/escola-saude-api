import { Disclosure } from '@headlessui/react';
import { ChevronUp } from 'lucide-react';

const perguntas = [
  {
    pergunta: 'Esqueci minha senha. O que devo fazer?',
    resposta: 'Clique em “Recuperar Senha” na tela de login e siga as instruções enviadas para seu e-mail.'
  },
  {
    pergunta: 'Como atualizo meus dados pessoais?',
    resposta: 'No menu “Perfil”, você pode alterar seu nome, e-mail, senha e assinatura digital.'
  },
  {
    pergunta: 'O certificado não apareceu. O que pode ter acontecido?',
    resposta: 'Certifique-se de que você compareceu a pelo menos 75% das aulas. Caso contrário, o certificado não é gerado automaticamente.'
  },
  {
    pergunta: 'Como confirmar minha presença em um evento?',
    resposta: 'Você deve escanear o QR Code da sala utilizando a opção “Escanear” do menu ou o botão disponível na sua turma.'
  },
  {
    pergunta: 'O sistema mostra que já estou inscrito. Como alterar minha inscrição?',
    resposta: 'Entre em contato com a equipe da Escola da Saúde para solicitar a alteração manual.'
  },
  {
    pergunta: 'Consigo cancelar minha inscrição em um evento?',
    resposta: 'Sim. Acesse “Minhas Inscrições” e clique em “Cancelar inscrição” (se ainda disponível para o evento).'
  },
  {
    pergunta: 'O que é a “Assinatura Digital” no sistema?',
    resposta: 'É uma imagem da sua assinatura que aparece automaticamente nos certificados emitidos. Você pode cadastrar ou atualizar essa imagem no menu “Perfil”.'
  },
  {
    pergunta: 'O QR Code do certificado não funciona. O que faço?',
    resposta: 'Verifique se o seu celular possui conexão com a internet e tente novamente. Caso persista, entre em contato com a equipe técnica.'
  }
];

export default function AccordionAjuda() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4 text-lousa dark:text-white">
        ❓ Ajuda / Perguntas Frequentes
      </h1>
      <div className="space-y-2">
        {perguntas.map((item, index) => (
          <Disclosure key={index}>
            {({ open }) => (
              <div>
                <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-left text-sm font-medium text-lousa bg-white rounded-lg dark:bg-zinc-800 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                  {item.pergunta}
                  <ChevronUp
                    className={`${
                      open ? 'transform rotate-180' : ''
                    } w-5 h-5 text-lousa dark:text-white transition-transform`}
                  />
                </Disclosure.Button>
                <Disclosure.Panel className="px-4 pt-2 pb-4 text-sm text-gray-700 dark:text-gray-300">
                  {item.resposta}
                </Disclosure.Panel>
              </div>
            )}
          </Disclosure>
        ))}
      </div>
    </div>
  );
}
