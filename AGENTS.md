# APolloMD — instruções permanentes

Antes de qualquer trabalho relacionado a infraestrutura, deploy, banco de dados ou serviços externos, leia primeiro `/ativarinfra.md`.

O APolloMD utiliza exclusivamente infraestrutura cloud. Não introduza dependências de `localhost`, banco local, Docker Desktop, Supabase local, emuladores locais ou outra infraestrutura executada no computador do desenvolvedor.

Nunca reutilize automaticamente contextos de Supabase, Vercel, GCP ou OpenAI pertencentes a outro projeto. Antes de qualquer ação externa, valide estes identificadores:

- GitHub: `doctoravatarapp/doctormd`
- Supabase project ref: `bscpfutlmsvbwgtkdudv`
- Vercel team: `luciano-terres-projects`
- GCP project: `avatar-504818`

Não exponha nem versione secrets. Qualquer mudança estrutural de infraestrutura deve atualizar também `/ativarinfra.md`.

Ao concluir alterações no projeto, sempre crie um commit com escopo claro. Como o ambiente é Cloud Only, execute o build oficial e faça deploy quando a alteração afetar aplicação, banco de dados, configuração ou infraestrutura cloud. Valide o deployment e o health check correspondente. Nunca inclua no commit arquivos não relacionados ou secrets.
