<template>
  <Dialog
    ref="dialog"
    v-model:visible="visible"
    modal
    :header="t('import_postgresql')"
    pt:content:class="grow p-3 pt-0"
    pt:footer:class="p-3"
    :draggable="false"
    :maximizable="$screenStore?.size?.md"
    :pt:root:class="{ 'p-dialog-maximized': !$screenStore?.size?.md }"
    :style="{ width: '60vw', height: '70vh' }"
  >
    <!-- Step 1: Connection -->
    <div v-if="currentStep === 'connection'" class="flex flex-col gap-4">
      <div class="text-muted-color">
        {{ t('connection_description') }}
      </div>

      <!-- Connection String Input -->
      <div class="flex flex-col gap-2">
        <label for="connectionString">{{ t('connection_string') }}</label>
        <Textarea
          id="connectionString"
          v-model="connectionString"
          :placeholder="connectionStringPlaceholder"
          class="font-mono"
          rows="2"
          @blur="parseConnectionString"
        />
      </div>

      <div class="text-center text-muted-color text-sm">
        {{ t('or_individual_fields') }}
      </div>

      <!-- Individual Connection Fields -->
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label for="host">{{ t('host') }}</label>
          <InputText
            id="host"
            v-model="connection.host"
            :placeholder="t('host_placeholder')"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label for="database">{{ t('database') }}</label>
          <InputText
            id="database"
            v-model="connection.database"
            :placeholder="t('database_placeholder')"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label for="port">{{ t('port') }}</label>
          <InputNumber
            id="port"
            v-model="connection.port"
            :min="1"
            :max="65535"
            :use-grouping="false"
            class="w-32"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label for="username">{{ t('username') }}</label>
          <InputText
            id="username"
            v-model="connection.username"
            :placeholder="t('username_placeholder')"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label for="password">{{ t('password') }}</label>
          <Password
            id="password"
            v-model="connection.password"
            :placeholder="t('password_placeholder')"
            toggle-mask
            :feedback="false"
          />
        </div>
      </div>

      <Message v-if="connectionError" severity="error">
        {{ connectionError }}
      </Message>
    </div>

    <!-- Step 2: Query and Mapping -->
    <div v-else-if="currentStep === 'query'" class="flex flex-col gap-4 h-full">
      <div class="text-muted-color">
        {{ t('query_description') }}
      </div>

      <div class="flex items-center gap-2">
        <ToggleSwitch v-model="showAdvancedMode" input-id="advanced" />
        <label for="advanced">{{ t('advanced_mode') }}</label>
      </div>

      <div v-if="showAdvancedMode" class="flex flex-col gap-2">
        <label>{{ t('sql_query') }}</label>
        <Textarea
          v-model="sqlQuery"
          rows="5"
          :placeholder="t('query_placeholder')"
          class="font-mono"
        />
        <Message severity="info" size="small">
          {{ t('query_help') }}
        </Message>
      </div>

      <div v-else class="flex flex-col gap-2">
        <label>{{ t('table_name') }}</label>
        <InputText v-model="tableName" :placeholder="t('table_placeholder')" />
      </div>

      <Button
        :label="t('preview_query')"
        :loading="previewLoading"
        :disabled="!canPreview"
        @click="loadPreview"
      />

      <!-- Preview and Mapping Table -->
      <div v-if="previewData" class="flex flex-col gap-4 grow">
        <Message severity="info">
          {{ t('preview_description', { count: previewData.rows.length }) }}
        </Message>

        <DataTable
          :value="previewData.rows"
          show-gridlines
          pt:tablecontainer:class="grow"
          scroll-height="flex"
          size="small"
          scrollable
        >
          <Column
            v-for="col in previewColumns"
            :key="col.field"
            :field="col.field"
            :pt="{ columnHeaderContent: 'flex-col w-full' }"
          >
            <template #header>
              <div class="justify-self-center">{{ col.header }}</div>
              <Select
                v-model="columnMapping[col.field]"
                :placeholder="t('select_column_placeholder')"
                option-value="value"
                option-label="label"
                class="w-full"
                :options="contactFieldOptions"
                :class="{
                  'border-(--p-contrast-500)':
                    columnMapping[col.field] === 'email',
                }"
                show-clear
              />
            </template>
            <template #body="{ data, field }">
              {{ data[field] }}
            </template>
          </Column>
        </DataTable>

        <Message v-if="totalRowCount !== null" severity="info" size="small">
          {{ t('total_rows', { count: totalRowCount }) }}
        </Message>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between w-full">
        <Button
          v-if="currentStep === 'query'"
          :label="t('back')"
          severity="secondary"
          icon="pi pi-arrow-left"
          @click="currentStep = 'connection'"
        />
        <div v-else />

        <div class="flex gap-2">
          <Button :label="t('cancel')" severity="secondary" @click="close" />
          <Button
            v-if="currentStep === 'connection'"
            :label="t('test_and_continue')"
            :loading="testingConnection"
            :disabled="!isConnectionValid"
            @click="testAndContinue"
          />
          <Button
            v-else
            v-tooltip.top="!hasEmailMapped && t('email_column_required')"
            :label="t('start_mining')"
            :loading="startingMining"
            :disabled="!canStartMining"
            severity="contrast"
            class="border-solid border-2 border-black"
            @click="startMining"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { Contact } from '~/types/contact';

const SOURCE = 'postgresql';
const { t } = useI18n({ useScope: 'local' });
const $leadminerStore = useLeadminerStore();
const $stepper = useMiningStepper();
const $toast = useToast();
const $screenStore = useScreenStore();

const dialog = ref();
const visible = ref(false);
const currentStep = ref<'connection' | 'query'>('connection');

// Connection form
const connectionString = ref('');
const connection = ref({
  host: '',
  port: 5432,
  database: '',
  username: '',
  password: '',
  ssl: true,
});
const connectionError = ref('');
const testingConnection = ref(false);

// Query form
const showAdvancedMode = ref(false);
const sqlQuery = ref('');
const tableName = ref('');
const previewLoading = ref(false);
const previewData = ref<{
  rows: Record<string, unknown>[];
  columns: string[];
} | null>(null);
const totalRowCount = ref<number | null>(null);
const columnMapping = ref<Record<string, string>>({});
const startingMining = ref(false);

const ROWS_PREVIEW_COUNT = 5;

const connectionStringPlaceholder =
  'postgresql://user:password@host:port/database?sslmode=require';

const contactFieldOptions: { value: keyof Contact; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'name', label: t('contact.name') },
  { value: 'given_name', label: t('contact.given_name') },
  { value: 'family_name', label: t('contact.family_name') },
  { value: 'alternate_name', label: t('contact.alternate_name') },
  { value: 'location', label: t('contact.location') },
  { value: 'works_for', label: t('contact.works_for') },
  { value: 'job_title', label: t('contact.job_title') },
  { value: 'same_as', label: t('contact.same_as') },
  { value: 'image', label: t('contact.image') },
];

const isConnectionValid = computed(() => {
  return (
    connection.value.host &&
    connection.value.database &&
    connection.value.username &&
    connection.value.password
  );
});

const canPreview = computed(() => {
  if (showAdvancedMode.value) {
    return sqlQuery.value.trim().length > 0;
  }
  return tableName.value.trim().length > 0;
});

const hasEmailMapped = computed(() => {
  return Object.values(columnMapping.value).includes('email');
});

const canStartMining = computed(() => {
  return previewData.value !== null && hasEmailMapped.value;
});

const previewColumns = computed(() => {
  if (!previewData.value) return [];
  return previewData.value.columns.map((col) => ({
    field: col,
    header: col,
  }));
});

function openModal() {
  visible.value = true;
  reset();
}

function close() {
  visible.value = false;
  reset();
}

function reset() {
  currentStep.value = 'connection';
  connectionString.value = '';
  connection.value = {
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: true,
  };
  connectionError.value = '';
  showAdvancedMode.value = false;
  sqlQuery.value = '';
  tableName.value = '';
  previewData.value = null;
  totalRowCount.value = null;
  columnMapping.value = {};
}

defineExpose({ openModal });

function parseConnectionString() {
  const uri = connectionString.value.trim();
  if (!uri) return;

  try {
    // Support postgresql:// and postgres:// schemes
    const url = new URL(uri.replace(/^postgres:/, 'postgresql:'));

    connection.value.host = url.hostname;
    connection.value.port = parseInt(url.port || '5432', 10);
    connection.value.database = url.pathname.replace(/^\//, '');
    connection.value.username = decodeURIComponent(url.username || '');
    connection.value.password = decodeURIComponent(url.password || '');

    // Check for sslmode query parameter
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode) {
      connection.value.ssl = sslmode !== 'disable';
    }

    // Clear the connection string after parsing
    connectionString.value = '';
  } catch {
    // Invalid URL, ignore and let user fill fields manually
  }
}

async function testAndContinue() {
  testingConnection.value = true;
  connectionError.value = '';

  try {
    const { $api } = useNuxtApp();
    await $api('/imap/mine/sources/postgresql/test', {
      method: 'POST',
      body: connection.value,
    });
    currentStep.value = 'query';
  } catch (error: unknown) {
    connectionError.value = extractErrorMessage(error, t('connection_failed'));
  } finally {
    testingConnection.value = false;
  }
}

async function loadPreview() {
  previewLoading.value = true;

  try {
    const query = showAdvancedMode.value
      ? sqlQuery.value
      : `SELECT * FROM ${tableName.value}`;

    const { $api } = useNuxtApp();
    const response = await $api('/imap/mine/postgresql/preview', {
      method: 'POST',
      body: {
        connection: connection.value,
        query,
      },
    });

    previewData.value = {
      rows: response.rows.slice(0, ROWS_PREVIEW_COUNT),
      columns: response.columns,
    };
    totalRowCount.value = response.totalCount;

    // Auto-map email column
    response.columns.forEach((col: string) => {
      const lowerCol = col.toLowerCase();
      if (lowerCol.includes('email')) {
        columnMapping.value[col] = 'email';
      }
    });
  } catch (error: unknown) {
    $toast.add({
      severity: 'error',
      summary: t('preview_failed'),
      detail: extractErrorMessage(error, t('preview_error')),
      life: 5000,
    });
  } finally {
    previewLoading.value = false;
  }
}

async function startMining() {
  startingMining.value = true;

  try {
    const query = showAdvancedMode.value
      ? sqlQuery.value
      : `SELECT * FROM ${tableName.value}`;

    await $leadminerStore.startMining(
      SOURCE,
      JSON.stringify({
        connection: connection.value,
        query,
        mapping: columnMapping.value,
        saveConnection: true,
      }),
    );

    $stepper.next();
    visible.value = false;
  } catch (error: unknown) {
    $toast.add({
      severity: 'error',
      summary: t('mining_failed'),
      detail: extractErrorMessage(error, t('mining_error')),
      life: 5000,
    });
  } finally {
    startingMining.value = false;
  }
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;

  const maybeError = error as {
    data?: { message?: string; error?: string };
    message?: string;
    statusMessage?: string;
  };

  return (
    maybeError.data?.message ||
    maybeError.data?.error ||
    maybeError.statusMessage ||
    maybeError.message ||
    fallback
  );
}
</script>

<i18n lang="json">
{
  "en": {
    "import_postgresql": "Import from PostgreSQL",
    "connection_description": "Enter your PostgreSQL database connection details or paste a connection string.",
    "connection_string": "Connection String (optional)",
    "or_individual_fields": "— or enter individual fields —",
    "host": "Host",
    "host_placeholder": "db.example.com",
    "port": "Port",
    "database": "Database",
    "database_placeholder": "my_database",
    "username": "Username",
    "username_placeholder": "db_user",
    "password": "Password",
    "password_placeholder": "Enter password",
    "test_and_continue": "Test Connection & Continue",
    "connection_failed": "Failed to connect to database",
    "back": "Back",
    "cancel": "Cancel",
    "query_description": "Choose how to select your data.",
    "advanced_mode": "Advanced mode (custom SQL)",
    "sql_query": "SQL Query",
    "query_placeholder": "SELECT email, name, company FROM leads WHERE active = true",
    "query_help": "Only SELECT queries are allowed. The query will be executed on the connected database.",
    "table_name": "Table Name",
    "table_placeholder": "contacts",
    "preview_query": "Preview Data",
    "preview_description": "Showing first {count} rows. Map columns to contact fields below.",
    "preview_failed": "Preview Failed",
    "preview_error": "Could not load preview data",
    "total_rows": "Total rows to import: {count}",
    "select_column_placeholder": "Select field",
    "email_column_required": "Please map at least one column to Email",
    "start_mining": "Start Import",
    "mining_failed": "Import Failed",
    "mining_error": "Could not start import",
    "contact": {
      "name": "Name",
      "given_name": "First Name",
      "family_name": "Last Name",
      "alternate_name": "Alternate Name",
      "location": "Location",
      "works_for": "Company",
      "job_title": "Job Title",
      "same_as": "Website",
      "image": "Image URL"
    }
  },
  "fr": {
    "import_postgresql": "Importer depuis PostgreSQL",
    "connection_description": "Entrez les détails de connexion à votre base de données PostgreSQL ou collez une chaîne de connexion.",
    "connection_string": "Chaîne de connexion (optionnel)",
    "or_individual_fields": "— ou entrez les champs individuellement —",
    "host": "Hôte",
    "host_placeholder": "db.exemple.com",
    "port": "Port",
    "database": "Base de données",
    "database_placeholder": "ma_base",
    "username": "Nom d'utilisateur",
    "username_placeholder": "utilisateur_db",
    "password": "Mot de passe",
    "password_placeholder": "Entrez le mot de passe",
    "test_and_continue": "Tester la connexion et continuer",
    "connection_failed": "Échec de la connexion à la base de données",
    "back": "Retour",
    "cancel": "Annuler",
    "query_description": "Choisissez comment sélectionner vos données.",
    "advanced_mode": "Mode avancé (SQL personnalisé)",
    "sql_query": "Requête SQL",
    "query_placeholder": "SELECT email, name, company FROM leads WHERE active = true",
    "query_help": "Seules les requêtes SELECT sont autorisées. La requête sera excutée sur la base de données connectée.",
    "table_name": "Nom de la table",
    "table_placeholder": "contacts",
    "preview_query": "Aperçu des données",
    "preview_description": "Affichage des {count} premières lignes. Mappez les colonnes aux champs de contact ci-dessous.",
    "preview_failed": "Échec de l'aperçu",
    "preview_error": "Impossible de charger les données d'aperçu",
    "total_rows": "Nombre total de lignes à importer : {count}",
    "select_column_placeholder": "Sélectionner un champ",
    "email_column_required": "Veuillez mapper au moins une colonne vers Email",
    "start_mining": "Démarrer l'import",
    "mining_failed": "Échec de l'import",
    "mining_error": "Impossible de démarrer l'import",
    "contact": {
      "name": "Nom",
      "given_name": "Prénom",
      "family_name": "Nom de famille",
      "alternate_name": "Nom alternatif",
      "location": "Localisation",
      "works_for": "Entreprise",
      "job_title": "Titre du poste",
      "same_as": "Site web",
      "image": "URL de l'image"
    }
  }
}
</i18n>
