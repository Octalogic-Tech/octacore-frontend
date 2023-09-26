<template>
  <div v-if="dialog" class="add-receipts" @click="closeDialog">
    <div class="popup-content" @click.stop>
      <v-card class="card">
        <v-card-title class="text-textSecondary"> Add Bill </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="submitForm">
            <!-- data field -->
            <v-text-field
              v-model="date"
              required
              variant="outlined"
              type="date"
              label="Date"
              placeholder="mm/dd/yyyy"
              @blur="validateField"
              class="mb-0"
              :error-messages="
                errorMassage.date ? 'Date field must be required.' : ''
              "
            ></v-text-field>
            <!-- amount field -->
            <v-text-field
              v-model="amount"
              required
              label="Amount"
              placeholder="Amount..."
              variant="outlined"
              type="number"
              class="mt-1"
              @blur="validateField"
              :error-messages="
                errorMassage.amount ? 'amount field must be required.' : ''
              "
            ></v-text-field>
            <!-- bill type field -->
            <v-select
              v-model="billType"
              :items="billTypes"
              required
              label="Bill Type"
              variant="outlined"
              class="mt-1"
              @blur="validateField"
              :error-messages="
                errorMassage.billType ? 'billtype field must be required.' : ''
              "
            ></v-select>
            <!-- reimbursement field -->
            <v-radio-group
              :value="reimbursement"
              v-model="reimbursement"
              row
              @blur="validateField"
              class="mt-1"
              :error-messages="
                errorMassage.reimbursement
                  ? 'reimbursement field must be required.'
                  : ''
              "
            >
              <v-label>Reimbursement</v-label>
              <v-radio value="Yes" label="Yes"></v-radio>
              <v-radio value="No" label="No"></v-radio>
            </v-radio-group>
            <!-- add by field -->
            <v-select
              v-model="addedBy"
              :items="addedByTypes"
              required
              label="Expence added by"
              variant="outlined"
              @blur="validateField"
              class="mt-1"
              :error-messages="
                errorMassage.addedBy ? 'Expence field must be required.' : ''
              "
            ></v-select>
            <!-- image upload field -->
            <!-- <v-file-input
                  v-model="selectedFile"
                  label="Upload Bill"
                  accept="image/*"
                  prepend-icon="mdi-camera"
                  variant="outlined"
                  @change="handleFileChange"
                  class="w-100"
                  color=secondary
                ></v-file-input> -->
            <div class="d-flex pa-2 align-center">
              <p class="text-subtitle-1 text-textSecondary px-1">
                Upload Bills
              </p>
              <v-btn
                flat
                @click.stop="openFileInput"
                class="text-secondary text-h5"
                hieght="24px"
                min-width="20px"
                @blur="validateField"
              >
                <v-icon>mdi-camera</v-icon></v-btn
              >
              <v-label v-if="selectedFile[0]">{{
                selectedFile[0].name
              }}</v-label>
              <p
                class="text-error text-body-2"
                v-if="errorMassage.selectedFile"
              >
                File must be required.
              </p>
            </div>

            <!-- Submit button -->
            <v-btn
              type="submit"
              class="w-100 my-1 text-system-primary-1"
              style="border-radius: 16px"
              height="48px"
              color="secondary-darken-2"
              >Submit</v-btn
            >
            <v-btn
              @click="closeDialog"
              class="w-100 d-sm-none my-1 text-system-primary-1"
              style="border-radius: 16px"
              height="48px"
              >Cancel</v-btn
            >
          </v-form>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { required } from '@vuelidate/validators';
import { useVuelidate } from '@vuelidate/core';

export default defineComponent({
  name: 'AddBills',
  props: {
    dialog: {
      required: true,
      type: Boolean,
    },
  },
  data: () => ({
    v$: useVuelidate(),
    date: '',
    amount: '',
    billType: '',
    reimbursement: 'Yes',
    addedBy: '',
    selectedFile: [] as File[],
    billTypes: ['Regular', 'Incentive', 'Bonus'],
    addedByTypes: ['User-Type-A', 'User-Type B', 'user-Type-  C'],
    errorMassage: {
      date: false,
      amount: false,
      billType: false,
      reimbursement: false,
      addedBy: false,
      selectedFile: false,
    },
  }),

  methods: {
    // dialog emitter-------
    openDialog() {
      this.$emit('open-dialog');
    },
    closeDialog() {
      this.$emit('close-dialog');
    },
    //form handler-----------
    submitForm() {
      if (this.v$.$invalid) {
        this.validateField();
      } else {
        alert('axios call');
      }
    },
    //file uploader popup------------
    openFileInput() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', this.handleFileChange);
      input.click();
    },
    //image file handler --------------
    handleFileChange(event: Event) {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
        this.selectedFile = [input.files[0]];
        console.log(this.selectedFile[0].name);
      }
    },
    validateField() {
      this.v$.date.required.$invalid
        ? (this.errorMassage.date = true)
        : (this.errorMassage.date = false);
      this.v$.amount.required.$invalid
        ? (this.errorMassage.amount = true)
        : (this.errorMassage.amount = false);
      this.v$.billType.required.$invalid
        ? (this.errorMassage.billType = true)
        : (this.errorMassage.billType = false);
      this.v$.reimbursement.required.$invalid
        ? (this.errorMassage.reimbursement = true)
        : (this.errorMassage.reimbursement = false);
      this.v$.addedBy.required.$invalid
        ? (this.errorMassage.addedBy = true)
        : (this.errorMassage.addedBy = false);
      this.v$.selectedFile.required.$invalid
        ? (this.errorMassage.selectedFile = true)
        : (this.errorMassage.selectedFile = false);
    },
  },
  //form validation schema--------------
  validations() {
    return {
      date: { required },
      amount: { required },
      billType: { required },
      reimbursement: { required },
      addedBy: { required },
      selectedFile: { required },
    };
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
  max-height: 100vh;
  overflow: auto;
}
@media (max-width: 600px) {
  .popup-content {
    width: 100%;
    max-height: 100vh;
  }
}

.small-display {
  max-width: 100%;
}
.card {
  min-height: 50%;
  overflow: auto;
}
</style>
