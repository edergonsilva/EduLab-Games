# Como Rodar Localmente

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/)
- Linux Mint (ou qualquer distribuição Linux / macOS / Windows com WSL2)

## 1. Clonar o repositório

```bash
git clone https://github.com/edergonsilva/EduLab-Games.git
cd EduLab-Games
```

## 2. Configurar variáveis de ambiente (opcional)

Crie um arquivo `.env` na raiz do projeto para personalizar a senha do admin:

```bash
echo "ADMIN_PASSWORD=minha-senha-segura" > .env
```

Se não criar, a senha padrão é `edulab@admin`.  
**Troque a senha antes de usar em ambiente de produção!**

## 3. Subir os serviços

```bash
docker compose up --build
```

Após o build, a plataforma estará disponível em:

| Serviço | URL |
|---------|-----|
| 🌐 Frontend (alunos/professores) | http://localhost:3000 |
| 🔧 Backend (API) | http://localhost:8000 |
| 📖 Documentação da API | http://localhost:8000/docs |

## 4. Parar os serviços

```bash
docker compose down
```

---

## Modo de desenvolvimento local (sem Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\activate        # Windows

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend em desenvolvimento (porta 5173) já está configurado para fazer proxy
das chamadas `/api` e `/health` para `http://localhost:8000`.

---

## Rede local (laboratório escolar)

Para que os alunos acessem a plataforma de outros computadores do laboratório,
descubra o IP do servidor:

```bash
ip addr show | grep 'inet '
```

Então acesse de qualquer computador da rede:
```
http://IP-DO-SERVIDOR:3000
```

---

## Problemas comuns

### `connection refused` no frontend
Verifique se o container do backend está rodando:
```bash
docker compose ps
docker compose logs backend
```

### Porta 3000 ou 8000 já em uso
Edite o `docker-compose.yml` e mude as portas mapeadas:
```yaml
ports:
  - "3001:80"   # frontend
  - "8001:8000" # backend
```
