<template>
  <div>
    <v-btn
      flat
      class="text-system-primary-1 text-body-2 w-100"
      color="secondary-darken-1"
      height="24px"
      @click="openDialog"
      >Export-CSV</v-btn
    >
    <div v-if="dialog" class="add-receipts" @click="closeDialog">
      <div class="popup-content" @click.stop>
        <div class="text-subtitle-1 text-textSecondary">CSV File Download</div>
        <div class="bg-white filter-container">
          <Datepicker
            placeholder="Start Date"
            class="ma-0 pa-3 w-100"
            v-model="startDate"
            :max-date="endRefDate"
            calendar-button-icon="mdi mdi-calendar"
          ></Datepicker>
        </div>
        <div class="bg-white filter-container">
          <Datepicker
            placeholder="End Date"
            class="ma-0 pa-3 h-100 w-100"
            v-model="endDate"
            :min-date="startRefDate"
          ></Datepicker>
        </div>
        <div>
          <v-select
            v-model="approveFilter"
            :items="approveItems"
            required
            label="Filter by Approval"
            variant="outlined"
            class="mt-1"
          ></v-select>
        </div>
        <v-row class="d-none d-sm-flex">
          <v-col cols="6">
            <v-row>
              <v-col cols="6">
                <v-btn
                  class="w-100 rounded-lg"
                  flat
                  variant="outlined"
                  color="text-system-primary-1"
                  height="50px"
                  @click="clearFilteredDate"
                  >Clear Filters</v-btn
                >
              </v-col>
            </v-row>
          </v-col>
          <v-col cols="6">
            <v-row>
              <v-col cols="6">
                <v-btn
                  class="w-100 rounded-lg"
                  plain
                  flat
                  height="50px"
                  @click="closeDialog"
                  >Exit</v-btn
                ></v-col
              >
              <v-col cols="6"
                ><v-btn
                  class="w-100 text-system-primary-1 rounded-lg"
                  height="50px"
                  flat
                  color="secondary-darken-1"
                  @click="filterAndExportCSV"
                  >Download</v-btn
                ></v-col
              >
            </v-row>
          </v-col>
        </v-row>
        <v-row class="d-flex d-sm-none">
          <v-col cols="12"
            ><v-btn
              class="w-100 text-system-primary-1 rounded-lg"
              height="50px"
              flat
              color="secondary-darken-1"
              @click="filterAndExportCSV"
              >Download</v-btn
            ></v-col
          >
          <v-col cols="12">
            <v-btn
              class="w-100 rounded-lg"
              flat
              variant="outlined"
              color="text-system-primary-1"
              height="50px"
              @click="clearFilteredDate"
              >Clear Filters</v-btn
            >
          </v-col>
          <v-col cols="12">
            <v-btn
              class="w-100 rounded-lg"
              plain
              flat
              height="50px"
              @click="closeDialog"
              >Exit</v-btn
            ></v-col
          >
        </v-row>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { BillTableItem } from '../interfaces/billInterfaces';
import Datepicker from 'vue3-datepicker';

export default defineComponent({
  props: {
    tableData: {
      required: true,
      type: Array as () => BillTableItem[],
    },
  },
  components: {
    Datepicker,
  },
  data: () => {
    return {
      dialog: false,
      startRefDate: new Date(),
      endRefDate: new Date(),
      startDate: undefined as Date | undefined,
      endDate: undefined as Date | undefined,
      datePickerFormat: 'yyyy-MM-dd',
      approveFilter: 'All',
      approveItems: ['All', 'Pending', 'Approved'],
    };
  },
  methods: {
    openDialog(): void {
      this.dialog = true;
    },
    closeDialog(): void {
      this.clearFilteredDate();
      this.dialog = false;
    },
    clearFilteredDate(): void {
      this.startDate = undefined;
      this.endDate = undefined;
      this.approveFilter = 'All';
    },
    approvalFilterFunc(boolVal: boolean): boolean {
      if (this.approveFilter === 'All') return true;
      else if (this.approveFilter === 'Approved') {
        if (boolVal === true) return true;
        else return false;
      } else {
        if (boolVal === false) return true;
        else return false;
      }
    },
    filterAndExportCSV(): void {
      if (this.startDate && this.endDate) {
        const filteredData = this.tableData.filter((item) => {
          const billDate = new Date(item.billDate);
          return (
            billDate >= this.startDate! &&
            billDate <= this.endDate! &&
            this.approvalFilterFunc(item.approved)
          );
        });
        this.exportCSV(filteredData);
      } else if (this.startDate) {
        const filteredData = this.tableData.filter((item) => {
          const billDate = new Date(item.billDate);
          return (
            billDate >= this.startDate! &&
            this.approvalFilterFunc(item.approved)
          );
        });
        this.exportCSV(filteredData);
      } else if (this.endDate) {
        const filteredData = this.tableData.filter((item) => {
          const billDate = new Date(item.billDate);
          return (
            billDate <= this.endDate! && this.approvalFilterFunc(item.approved)
          );
        });
        this.exportCSV(filteredData);
      } else if (this.approveFilter !== 'All') {
        const filteredData = this.tableData.filter((item) => {
          const billDate = new Date(item.billDate);
          return this.approvalFilterFunc(item.approved);
        });
        this.exportCSV(filteredData);
      } else {
        this.exportCSV(this.tableData);
      }
    },
    exportCSV(data: BillTableItem[]): void {
      if (data.length) {
        const headers = Object.keys(data[0]);
        const rows = data.map((obj) =>
          headers.map((header) => String(obj[header]))
        );
        const headerRow = headers.join(',');
        const csvRows = [headerRow, ...rows.map((row) => row.join(','))];
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'export_data.csv');
        link.click();
      }
    },
    convertToCSv(data: BillTableItem[]): string {
      const headers = Object.keys(data[0]);
      const rows = data.map((obj) =>
        headers.map((header) => String(obj[header]))
      );
      const headerRow = headers.join(',');
      const csvRows = [headerRow, ...rows.map((row) => row.join(','))];
      return csvRows.join('\n');
    },
  },
});
</script>

<style scoped>
.add-receipts {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.popup-content {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
  width: 620px;
  min-height: 50vh;
  max-height: 90vh;
}
.filter-container {
  border: 1px solid lightgray;
  height: 50px;
  border-radius: 4px;
  margin: 4px 0;
}
@media (max-width: 600px) {
  .popup-content {
    width: 100%;
    max-height: 100vh;
  }
}
.btn {
  height: 60px;
}
</style>
