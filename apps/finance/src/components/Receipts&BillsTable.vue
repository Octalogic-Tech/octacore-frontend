<template>
  <div>
    <v-container class="pa-0">
      <v-row align-sm="center">
        <v-col cols="12" sm="6">
          <h4 class="text-textSecondary table-label">UPLOADED DOCUMENTS</h4>
        </v-col>
        <v-col cols="12" sm="6">
          <div
            class="d-flex flex-column flex-sm-row align-start align-sm-center justify-sm-center"
          >
            <div class="pa-1">
              <span class="material-symbols-outlined me-5">filter_list</span>
            </div>
            <div class="pa-1 w-100">
              <input
                class="search-field bg-white"
                type="search"
                placeholder="Search By name"
                v-model="nameSearchQuery"
              />
            </div>
            <div class="pa-1 pa-sm-0 w-100">
              <input
                class="search-field bg-white"
                type="search"
                placeholder="Search By phone"
                v-model="phoneSearchQuery"
              />
            </div>
          </div>
        </v-col>
      </v-row>
      <!-- table section -->
      <v-row>
        <v-col>
          <v-table class="main-table">
            <thead>
              <tr class="table-head-row">
                <th
                  v-for="(head, i) in headers"
                  :key="i"
                  class="text-left text-textPrimary"
                >
                  {{ head }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                class="table-body-row"
                v-for="(item, index) in filteredTableData"
                :key="index"
              >
                <td>{{ item.name }}</td>
                <td>{{ item.phone }}</td>
                <td>{{ item.amount }}</td>
                <td>{{ item.designation }}</td>
                <td>{{ item.uploaded }}</td>
                <td>
                  <v-btn
                    flat
                    :class="{
                      'text-capitalize': true,
                      'bg-primary-darken-1': item.status,
                      'bg-secondary-darken-1': !item.status,
                    }"
                    style="font-size: 12px"
                    >Dummy</v-btn
                  >
                </td>
                <td class="text-center">
                  <ReceiptBillsMenu />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
      <!-- Fab button section -->
      <v-fab-transition style="height: 48px;">
        <v-btn
          color="secondary-darken-2"
          class="float-button text-system-primary-1"
          fab
          @click="openDialog"
        >
          <span class="material-symbols-outlined">add</span>
          <p class="text-capitalize">Add Receipt / Bill</p>
        </v-btn>
      </v-fab-transition>
    </v-container>
    <ReceiptAddBillsDialogue
      :dialog="addBilldialogOpen"
      @close-dialog="closeDialog"
      @open-dialog="openDialog"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import axios from 'axios';
import ReceiptAddBillsDialogue from './Receipt-Add-Bills-dialogue.vue';
import ReceiptBillsMenu from './Receipt-Bills-Menu.vue';
interface TableItem {
  id: string;
  name: string;
  phone: string;
  amount: string;
  designation: string;
  uploaded: string;
  status: boolean;
}

export default defineComponent({
  name: 'ReceiptsBillsTable',
  components: {
    ReceiptAddBillsDialogue,
    ReceiptBillsMenu,
  },
  data: () => ({
    searchQuery: '',
    headers: [
      'Employee',
      'Phone Number',
      'Amount',
      'Destination',
      'Uploaded At',
      'Status',
      'Action',
    ],
    tableData: [] as TableItem[],
    pagination: {
      page: 1,
      itemsPerPage: 5,
    },
    //dialog variable
    addBilldialogOpen: true,
    // sarch query variable---
    nameSearchQuery: '',
    phoneSearchQuery: '',
  }),
  methods: {
    fetchData() {
      axios
        .get<TableItem[]>('http://localhost:3001/receipts')
        .then((response) => {
          this.tableData = response.data;
        })
        .catch((error) => {
          console.error('Error fetching data:', error);
        });
    },
    openDialog() {
      this.addBilldialogOpen = true;
    },
    closeDialog() {
      this.addBilldialogOpen = false;
    },
  },
  mounted() {
    this.fetchData();
  },
  computed: {
    //pegination for table------
    pagedTableData(): TableItem[] {
      const start = (this.pagination.page - 1) * this.pagination.itemsPerPage;
      const end = start + this.pagination.itemsPerPage;
      return this.tableData.slice(start, end);
    },
    //search table-----------
    filteredTableData(): TableItem[] {
      const nameQuery = this.nameSearchQuery.toLowerCase();
      const phoneQuery = this.phoneSearchQuery.toLowerCase();

      if (nameQuery === '' && phoneQuery === '') {
        return this.tableData;
      } else {
        return this.tableData.filter((item) => {
          const nameMatch = item.name.toLowerCase().includes(nameQuery);
          const phoneMatch = item.phone.toLowerCase().includes(phoneQuery);
          return nameMatch && phoneMatch;
        });
      }
    },
  },
});
</script>
<style scoped>
.search-field {
  border: 1px solid lightgray;
  padding: 1px 1px 1px 4px;
  width: 100%;
  border-radius: 6px;
}

.search-field:focus {
  outline: none;
}

.table-label {
  font-size: 1rem;
  font-weight: 500;
}

.main-table {
  border-radius: 6px;
  margin-bottom: 50px;
}
tr {
  font-size: 14px;
}
.table-head-row {
  padding: 8px 0px 16px 0px;
}
.table-body-row {
  padding: 8px 0px 8px 0px;
}
.float-button {
  position: fixed;
  bottom: 20px;
  right: 35px;
  border-radius: 16px;
  height: 56px;
}
</style>
