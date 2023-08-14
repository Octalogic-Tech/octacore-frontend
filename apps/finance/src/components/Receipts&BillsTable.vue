<template>
  <div>
    <v-container class="pa-0">
      <v-row align-sm="center">
        <v-col cols="12" sm="4">
          <h4 class="text-textSecondary text-uppercase table-label">
            Uploaded Bills
          </h4>
        </v-col>
        <v-col cols="12" sm="8">
          <v-row>
            <v-col xs="12" sm="4">
              <Datepicker
                placeholder="Start Date"
                class="ma-0 px-1 w-100 bg-white rounded-sm"
                v-model="startDate"
                :max-date="endRefDate"
              ></Datepicker>
            </v-col>
            <v-col cols="12" sm="4">
              <Datepicker
                placeholder="End Date"
                class="ma-0 px-1 w-100 bg-white rounded-sm"
                v-model="endDate"
                :min-date="startRefDate"
              ></Datepicker>
            </v-col>
            <v-col cols="6" sm="2">
              <v-btn
                flat
                class="text-system-primary-1 text-body-2 w-100"
                color="secondary-darken-1"
                height="24px"
                >Search</v-btn
              >
            </v-col>
            <v-col cols="6" sm="2">
              <BillsCSVDialog :tableData="tableData"
            /></v-col>
          </v-row>
          <!-- <div
            class="d-flex flex-column flex-sm-row align-start align-sm-center justify-sm-center"
          > -->
          <!-- <div class="mx-1">
              <span class="material-symbols-outlined me-5">filter_list</span>
            </div> -->
          <!-- <div class="mx-1 w-100 bg-white search-container"></div>
            <div class="mx-1 w-100 bg-white search-container">
             
            </div>
            <div class="">
             
            </div>
            
          </div> -->
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
                  :class="{
                    'text-textPrimary': true,
                    'font-weight-bold': true,
                    'text-left':
                      head !== 'Status' &&
                      head !== 'Reimbursement' &&
                      head !== 'Action',
                    'text-center':
                      head === 'Status' ||
                      head === 'Reimbursement' ||
                      head === 'Action',
                  }"
                >
                  {{ head }}
                </th>
              </tr>
            </thead>
            <tbody v-if="tableData.length">
              <tr
                class="table-body-row"
                v-for="(item, index) in filteredTableData"
                :key="index"
              >
                <td>{{ item.billDate }}</td>
                <td>{{ item.amount }}</td>
                <td>{{ item.billType }}</td>
                <td class="text-center">
                  {{ item.actualExpense ? 'Yes' : 'No' }}
                </td>
                <td>{{ item.uploadedBy }}</td>
                <td>
                  <v-btn
                    flat
                    :class="{
                      'text-capitalize': true,
                      'bg-primary-darken-1': item.approved,
                      'bg-secondary-darken-1': !item.approved,
                      'px-0': true,
                    }"
                    height="30px"
                    width="100%"
                    style="font-size: 12px"
                    >{{ item.approved ? 'Approved' : 'Pending' }}</v-btn
                  >
                </td>
                <td class="text-left">
                  <ReceiptBillsMenu />
                </td>
              </tr>
            </tbody>
            <v-card v-if="!tableData.length">
              <h2 class="text-center text-textSecondary">No data</h2>
            </v-card>
          </v-table>
        </v-col>
      </v-row>
      <!-- Fab button section -->
      <v-fab-transition style="height: 48px">
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
import Datepicker from 'vue3-datepicker';
import BillsCSVDialog from './BillsCSVDialog.vue';
import { BillTableItem } from '../interfaces/billInterfaces';

export default defineComponent({
  name: 'ReceiptsBillsTable',
  components: {
    ReceiptAddBillsDialogue,
    ReceiptBillsMenu,
    Datepicker,
    BillsCSVDialog,
  },
  data: () => ({
    searchQuery: '',
    headers: [
      'Date',
      'Amount',
      'Bill Type',
      'Reimbursement',
      'Added By',
      'Status',
      'Action',
    ],
    tableData: [] as BillTableItem[],
    pagination: {
      page: 1,
      itemsPerPage: 5,
    },
    //dialog variable
    addBilldialogOpen: false,
    // sarch query variable---
    nameSearchQuery: '',
    phoneSearchQuery: '',

    startRefDate: new Date(),
    endRefDate: new Date(),
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    datePickerFormat: 'yyyy-MM-dd',
  }),
  methods: {
    fetchData() {
      axios
        .get<BillTableItem[]>('http://localhost:3001/getBills')
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
    pagedTableData(): BillTableItem[] {
      const start = (this.pagination.page - 1) * this.pagination.itemsPerPage;
      const end = start + this.pagination.itemsPerPage;
      return this.tableData.slice(start, end);
    },
    //search table-----------
    filteredTableData(): BillTableItem[] {
      const nameQuery = this.nameSearchQuery.toLowerCase();
      const phoneQuery = this.phoneSearchQuery.toLowerCase();

      if (nameQuery === '' && phoneQuery === '') {
        return this.tableData;
      } else {
        // return this.tableData.filter((item) => {
        //   const nameMatch = item.name.toLowerCase().includes(nameQuery);
        //   const phoneMatch = item.phone.toLowerCase().includes(phoneQuery);
        //   return nameMatch && phoneMatch;
        // });
        return this.tableData;
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
  height: 10px;
  padding: 0;
}
.float-button {
  position: fixed;
  bottom: 20px;
  right: 35px;
  border-radius: 16px;
  height: 56px;
}
.search-container {
  border: 1px solid lightgray;
  border-radius: 2px;
}
</style>
