Quiero crear una aplicacion te dare la idea y me ayudartas a crear los documentos necesarios para desarrollarla de inicio a fin. 

Idea: crear una aplicacion multiusuario la cual guarde links, estos links pueden ser privados o publicos pueden ser compartidos, se les puede dar like, tambien los usuarios pueden agregar sus propias categorias para poder tener algun tipo de organizacion en sus links, existira una pagina principal para mostrar algunos links e informacion de la app, existira otra web donde se mostrara cuales son los links mas visitados por dia, semana, mes y año y los que tienen mas likes, tambien los que se han agregado a favorito mas veces, existira pagina de login, registro y recuperacion de contraseña, tendran un perfil que podran modificar, y un dashboard donde podran crear sus categorias y sus links, si se le da click al link podran ver cuantas visitas ha tenido para esto necesitaremos guardar un log de todas las visitas por ip y los que han guardado su link a favoritos osea que basicamente es una vista de detalle del link en el dashboard, tambien implementaremos un sistema de medallas o algo asi para indicar al usuario cuando ha agregado link por ejemplo hierro al que tiene su primer link, bronce al que tiene 10 links agregados, etc hasta 100, 1000 y un millon el maximo de alguna manera el usuario creador podra mostrar su perfil y ver el rango que tiene. Tambien necesitaremos agregar una pagina especial en el dashboard para tener a la mano todos los links que ha creado, poder organizarlos y buscarlos por sus propias categorias en caso que lo necesite. quizas me falta mas cosas pero la idea es que no se te pierdan link de tantos que existen en el internet poder tenerlos ordenados al gusto de cada persona y poder compartirlos de alguna manera con los demas, 

Datos: quizas cada link tiene que usuario lo creo, un nombre para reconocerlo, el link, un link corto para poder redirecionar y compartir, los likes que tiene, las veces que se guardo, y la cantidad de vistas que ha tenido, si es privado o publico, la fecha que se creo y la que se actualizo. Los usuarios podran crear su cuenta solamente con su Username unico, email que se necesita verificar, y su contraseña, luego en su perfil podran editar su avatar, y crear una pequeña descripcion. Las categorias supongon tendran el id del usuario que lo creo, un nombre y su descripcion, ademas fecha de creacion y actualizacion. necesitaremos una tabla de logs para guardan cuando visitan, dan like o agrean a favorito un link. Tambien tener en cuenta el sistema de Rango de usuarios y mostrarlo en su perfil. Quizas nos hace falta algo pero en el camino lo podremos revisar.

Tecnologia: 
  Backend: Bun, Elisya, Sqlite nativo de bun
  Frontend: SvelteKit, Tailwind, algo simple y agradable ademas de minimalista pero con tecnologia de punta.
  Auth: JWT
  
Importante: Reutilizar codigo, todo sea modular y simple de entender

Implementacion: hacer todo por pasos, crear un spec especifico por modulo y con tareas especificas para poder terminar la aplicacion de la mejor manera, tener un orden de carptas estricto, y una carpeta docs para guardar la documentacion. siempre usar subagentes crear un README que siempre se actualice, un AGENT.ms AGENTS.md y CLAUDE.md

Logica: La implementacion de todo se debe guardar en github https://github.com/furbox/hackaton-app asi que todo estara en un solo repositorio, ademas el dominio de la app es urloft.site, tener cuidado de no subir ningun .md mas que el README.md, llaves o informacion sencible

Acepto ideas.
