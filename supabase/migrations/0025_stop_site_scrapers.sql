-- The site scrapers (Hackza, Contester.Life, CAMPHUB, DekPort, Devpost) are retired: new
-- opportunities arrive through POST /api/imports (a daily ChatGPT search). Their hourly job goes;
-- import_runs keeps logging (source 'chatgpt', trigger 'api'), and email-outbox stays as it is.
select cron.unschedule('imports-sync') where exists (select 1 from cron.job where jobname = 'imports-sync');
